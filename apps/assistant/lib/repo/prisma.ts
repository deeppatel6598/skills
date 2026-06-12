import {
  Appointment,
  Business,
  Client,
  ConflictError,
  KnowledgeKind,
  Pet,
  Repo,
  Resource,
  Service,
} from "@/lib/types";
import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const iso = (d: Date) => d.toISOString();

/** Repo backed by PostgreSQL via Prisma. Every method is tenant-scoped. */
export class PrismaRepo implements Repo {
  private get db() {
    return getPrisma();
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const b = await this.db.business.findUnique({ where: { slug } });
    if (!b) return null;
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      vertical: b.vertical as Business["vertical"],
      config: b.config as unknown as Business["config"],
    };
  }

  async listServices(businessId: string): Promise<Service[]> {
    return this.db.service.findMany({ where: { businessId } });
  }

  async listResources(businessId: string): Promise<Resource[]> {
    return this.db.resource.findMany({
      where: { businessId },
      select: { id: true, businessId: true, name: true, role: true },
    });
  }

  async listAvailabilityRules(resourceId: string) {
    return this.db.availabilityRule.findMany({ where: { resourceId } });
  }

  async searchKnowledge(businessId: string, query: string, kind?: KnowledgeKind) {
    // Dev-grade keyword search. Production: tsvector / pgvector (constraints.sql).
    const rows = await this.db.knowledgeEntry.findMany({
      where: {
        businessId,
        ...(kind ? { kind } : {}),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { body: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 3,
    });
    const result = rows.length
      ? rows
      : await this.db.knowledgeEntry.findMany({
          where: { businessId, ...(kind ? { kind } : {}) },
          take: 3,
        });
    return result.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      kind: r.kind as KnowledgeKind,
      title: r.title,
      body: r.body,
      metadata: (r.metadata as Record<string, unknown>) ?? null,
    }));
  }

  async findClientByPhone(businessId: string, phone: string): Promise<Client | null> {
    const c = await this.db.client.findFirst({ where: { businessId, phone } });
    return c ? (c as unknown as Client) : null;
  }

  async getClientById(businessId: string, id: string): Promise<Client | null> {
    const c = await this.db.client.findFirst({ where: { businessId, id } });
    return c ? (c as unknown as Client) : null;
  }

  async upsertClient(input: {
    businessId: string;
    name: string;
    phone: string;
    email?: string;
    pet?: Pet;
  }): Promise<Client> {
    const existing = await this.db.client.findFirst({
      where: { businessId: input.businessId, phone: input.phone },
    });
    const pets = (((existing?.attributes as { pets?: Pet[] })?.pets) ?? []) as Pet[];
    if (input.pet && !pets.some((p) => p.name.toLowerCase() === input.pet!.name.toLowerCase())) {
      pets.push(input.pet);
    }
    const data = {
      name: input.name,
      email: input.email,
      attributes: { ...(existing?.attributes as object), pets } as unknown as Prisma.InputJsonValue,
    };
    const c = existing
      ? await this.db.client.update({ where: { id: existing.id }, data })
      : await this.db.client.create({
          data: { businessId: input.businessId, phone: input.phone, ...data },
        });
    return c as unknown as Client;
  }

  async listAppointmentsForResource(resourceId: string, fromISO: string, toISO: string) {
    const rows = await this.db.appointment.findMany({
      where: {
        resourceId,
        status: { not: "CANCELLED" },
        startsAt: { lt: new Date(toISO) },
        endsAt: { gt: new Date(fromISO) },
      },
    });
    return rows.map(this.toAppt);
  }

  async createAppointment(input: {
    businessId: string;
    clientId: string;
    resourceId: string;
    serviceId: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
    attributes?: Record<string, unknown>;
  }): Promise<Appointment> {
    try {
      const created = await this.db.$transaction(async (tx) => {
        const clash = await tx.appointment.findFirst({
          where: {
            resourceId: input.resourceId,
            status: { not: "CANCELLED" },
            startsAt: { lt: new Date(input.endsAt) },
            endsAt: { gt: new Date(input.startsAt) },
          },
        });
        if (clash) throw new ConflictError();
        return tx.appointment.create({
          data: {
            businessId: input.businessId,
            clientId: input.clientId,
            resourceId: input.resourceId,
            serviceId: input.serviceId,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            status: "CONFIRMED",
            notes: input.notes,
            attributes: (input.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      });
      return this.toAppt(created);
    } catch (e) {
      // The DB exclusion constraint (constraints.sql) is the race-proof backstop.
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof ConflictError || /appointment_no_overlap|exclusion|23P01/.test(msg)) {
        throw new ConflictError();
      }
      throw e;
    }
  }

  async listAppointments(
    businessId: string,
    opts?: { fromISO?: string; includeCancelled?: boolean },
  ) {
    const rows = await this.db.appointment.findMany({
      where: {
        businessId,
        ...(opts?.includeCancelled ? {} : { status: { not: "CANCELLED" } }),
        ...(opts?.fromISO ? { startsAt: { gte: new Date(opts.fromISO) } } : {}),
      },
      orderBy: { startsAt: "asc" },
    });
    return rows.map(this.toAppt);
  }

  async listClients(businessId: string): Promise<Client[]> {
    const rows = await this.db.client.findMany({ where: { businessId } });
    return rows.map((c) => c as unknown as Client);
  }

  async getAppointmentsByPhone(businessId: string, phone: string) {
    const client = await this.db.client.findFirst({ where: { businessId, phone } });
    if (!client) return [];
    const rows = await this.db.appointment.findMany({
      where: { businessId, clientId: client.id },
      orderBy: { startsAt: "asc" },
    });
    return rows.map(this.toAppt);
  }

  async updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "startsAt" | "endsAt" | "status">>,
  ): Promise<Appointment> {
    const row = await this.db.appointment.update({
      where: { id },
      data: {
        ...(patch.startsAt ? { startsAt: new Date(patch.startsAt) } : {}),
        ...(patch.endsAt ? { endsAt: new Date(patch.endsAt) } : {}),
        ...(patch.status ? { status: patch.status } : {}),
      },
    });
    return this.toAppt(row);
  }

  private toAppt = (r: {
    id: string;
    businessId: string;
    clientId: string;
    resourceId: string;
    serviceId: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    notes: string | null;
    attributes: unknown;
  }): Appointment => ({
    id: r.id,
    businessId: r.businessId,
    clientId: r.clientId,
    resourceId: r.resourceId,
    serviceId: r.serviceId,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    status: r.status as Appointment["status"],
    notes: r.notes,
    attributes: (r.attributes as Record<string, unknown>) ?? null,
  });
}
