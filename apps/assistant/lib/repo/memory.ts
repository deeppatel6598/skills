import { randomUUID } from "crypto";
import {
  AvailabilityRule,
  Appointment,
  Business,
  Client,
  ConflictError,
  KnowledgeEntry,
  KnowledgeKind,
  Pet,
  Repo,
  Resource,
  Service,
} from "@/lib/types";

/** Overlap test for two [start,end) ISO intervals. */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

const H = (h: number) => h * 60;

/**
 * Seed for the first tenant — "Paws & Care Veterinary Clinic". Constant data
 * (business, services, staff, hours, brand knowledge); clients and appointments
 * are mutable for the lifetime of the server process.
 */
function seed() {
  const businessId = "biz_paws";

  const business: Business = {
    id: businessId,
    slug: "paws-and-care",
    name: "Paws & Care Veterinary Clinic",
    vertical: "veterinary",
    config: {
      timezone: "America/New_York",
      assistantName: "Sofia",
      tagline: "Compassionate care for your furry family.",
      branding: { primary: "#2F6F6A", accent: "#E8B04B", bubbleEmoji: "🐾" },
      voice: {
        displayName: "Sofia",
        gender: "female",
        description:
          "soft-spoken, warm, gentle and unhurried — like a caring receptionist who loves animals",
        provider: "webspeech", // upgrade to "elevenlabs" with a warm voice id in production
        elevenLabsVoiceId: "",
        rate: 0.92,
        pitch: 1.02,
        preferVoiceNames: [
          "Samantha",
          "Google UK English Female",
          "Microsoft Aria Online (Natural)",
          "Microsoft Jenny Online (Natural)",
          "Victoria",
          "Karen",
          "Serena",
          "female",
        ],
      },
      tone: ["warm", "reassuring", "patient", "gentle"],
      hoursText: "Mon–Fri 8am–6pm, Sat 9am–2pm, closed Sunday",
      policies: [
        "Please arrive 10 minutes early for your first visit.",
        "We ask for 24 hours' notice for cancellations.",
        "Bring previous medical records and current medications for first visits.",
      ],
      emergencyLine: "(555) 911-PETS",
    },
  };

  const services: Service[] = [
    { id: "svc_wellness", businessId, name: "Wellness Exam", durationMin: 30, priceCents: 6500, description: "Routine head-to-tail check-up to keep your pet healthy." },
    { id: "svc_vaccine", businessId, name: "Vaccination", durationMin: 20, priceCents: 4000, description: "Core and booster vaccines." },
    { id: "svc_dental", businessId, name: "Dental Cleaning", durationMin: 60, priceCents: 18000, description: "Full dental scaling and polish." },
    { id: "svc_sick", businessId, name: "Sick Visit", durationMin: 30, priceCents: 9000, description: "Same-week visit when your pet isn't feeling well." },
    { id: "svc_groom", businessId, name: "Grooming", durationMin: 45, priceCents: 5500, description: "Bath, nails, and a tidy trim." },
  ];

  const resources: Resource[] = [
    { id: "res_reyes", businessId, name: "Dr. Amelia Reyes", role: "Veterinarian" },
    { id: "res_patel", businessId, name: "Dr. Liam Patel", role: "Veterinarian" },
  ];

  const rules: AvailabilityRule[] = [];
  for (const r of resources) {
    for (const weekday of [1, 2, 3, 4, 5]) {
      rules.push({ id: randomUUID(), resourceId: r.id, weekday, startMin: H(8), endMin: H(18) });
    }
    rules.push({ id: randomUUID(), resourceId: r.id, weekday: 6, startMin: H(9), endMin: H(14) });
  }

  const k = (kind: KnowledgeKind, title: string, body: string, metadata?: Record<string, unknown>): KnowledgeEntry => ({
    id: randomUUID(),
    businessId,
    kind,
    title,
    body,
    metadata,
  });

  const knowledge: KnowledgeEntry[] = [
    k("LOCATION", "Where are you located? Directions & parking", "We're at 248 Maple Street, Springfield — just off Route 9. There's free parking behind the building and the entrance is step-free.", { mapUrl: "https://maps.google.com/?q=248+Maple+Street+Springfield", phone: "(555) 248-7297" }),
    k("HOURS", "What are your opening hours?", "We're open Monday to Friday 8am–6pm, Saturday 9am–2pm, and we're closed on Sundays."),
    k("FACILITY", "What facilities and equipment do you have?", "Our clinic has a full in-house lab, digital X-ray and ultrasound, a dedicated surgical suite, an isolation ward, and a calm, separate cat waiting area so anxious kitties feel at ease."),
    k("SERVICE", "What services do you offer?", "We offer wellness exams, vaccinations, dental cleanings, sick visits, grooming, microchipping, and minor surgery."),
    k("PRICING", "How much does a visit cost?", "A wellness exam is $65 and vaccinations start at $40. We'll always talk you through any costs before treatment so there are no surprises."),
    k("POLICY", "What is your cancellation policy?", "We completely understand life happens — we just ask for 24 hours' notice so we can offer the slot to another family."),
    k("TEAM", "Who are your veterinarians?", "Dr. Amelia Reyes and Dr. Liam Patel lead our team, supported by four wonderful veterinary nurses."),
    k("FAQ", "Do you treat exotic pets?", "Yes — alongside cats and dogs, Dr. Patel also sees rabbits, guinea pigs, and birds."),
    k("FAQ", "What should I bring to my first visit?", "Please bring any previous medical records and a list of current medications — and of course, your pet!"),
    k("FAQ", "My pet ate something they shouldn't have — what do I do?", "Oh no, I'm so sorry — that's really worrying. I'm not able to give medical advice, but please call our emergency line right away at (555) 911-PETS, or I can help you book the very next available visit.", { urgent: true }),
    k("GENERAL", "Do you have parking and step-free access?", "Yes — free parking behind the building and a step-free entrance."),
  ];

  return { business, services, resources, rules, knowledge };
}

export class MemoryRepo implements Repo {
  private business: Business;
  private services: Service[];
  private resources: Resource[];
  private rules: AvailabilityRule[];
  private knowledge: KnowledgeEntry[];
  private clients: Client[] = [];
  private appointments: Appointment[] = [];

  constructor() {
    const s = seed();
    this.business = s.business;
    this.services = s.services;
    this.resources = s.resources;
    this.rules = s.rules;
    this.knowledge = s.knowledge;
  }

  async getBusinessBySlug(slug: string) {
    return this.business.slug === slug ? this.business : null;
  }

  async listServices(businessId: string) {
    return this.services.filter((s) => s.businessId === businessId);
  }

  async listResources(businessId: string) {
    return this.resources.filter((r) => r.businessId === businessId);
  }

  async listAvailabilityRules(resourceId: string) {
    return this.rules.filter((r) => r.resourceId === resourceId);
  }

  async searchKnowledge(businessId: string, query: string, kind?: KnowledgeKind) {
    const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    const pool = this.knowledge.filter(
      (e) => e.businessId === businessId && (!kind || e.kind === kind),
    );
    const scored = pool
      .map((e) => {
        const hay = `${e.title} ${e.body} ${e.kind}`.toLowerCase();
        const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const top = (scored.length ? scored.map((x) => x.e) : pool).slice(0, 3);
    return top;
  }

  async findClientByPhone(businessId: string, phone: string) {
    const norm = phone.replace(/\D/g, "");
    return (
      this.clients.find(
        (c) => c.businessId === businessId && c.phone.replace(/\D/g, "") === norm,
      ) ?? null
    );
  }

  async getClientById(businessId: string, id: string) {
    return this.clients.find((c) => c.businessId === businessId && c.id === id) ?? null;
  }

  async upsertClient(input: {
    businessId: string;
    name: string;
    phone: string;
    email?: string;
    pet?: Pet;
  }) {
    let client = await this.findClientByPhone(input.businessId, input.phone);
    if (!client) {
      client = {
        id: randomUUID(),
        businessId: input.businessId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        attributes: { pets: [] },
      };
      this.clients.push(client);
    } else {
      client.name = input.name || client.name;
      if (input.email) client.email = input.email;
    }
    if (input.pet) {
      const pets = (client.attributes?.pets ?? []) as Pet[];
      if (!pets.some((p) => p.name.toLowerCase() === input.pet!.name.toLowerCase())) {
        pets.push(input.pet);
      }
      client.attributes = { ...client.attributes, pets };
    }
    return client;
  }

  async listAppointmentsForResource(resourceId: string, fromISO: string, toISO: string) {
    return this.appointments.filter(
      (a) =>
        a.resourceId === resourceId &&
        a.status !== "CANCELLED" &&
        a.startsAt < toISO &&
        a.endsAt > fromISO,
    );
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
  }) {
    // Application-level guard (mirrors the Postgres exclusion constraint).
    const clash = this.appointments.some(
      (a) =>
        a.resourceId === input.resourceId &&
        a.status !== "CANCELLED" &&
        overlaps(a.startsAt, a.endsAt, input.startsAt, input.endsAt),
    );
    if (clash) throw new ConflictError();

    const appt: Appointment = {
      id: randomUUID(),
      businessId: input.businessId,
      clientId: input.clientId,
      resourceId: input.resourceId,
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "CONFIRMED",
      notes: input.notes,
      attributes: input.attributes,
    };
    this.appointments.push(appt);
    return appt;
  }

  async listAppointments(
    businessId: string,
    opts?: { fromISO?: string; includeCancelled?: boolean },
  ) {
    return this.appointments
      .filter(
        (a) =>
          a.businessId === businessId &&
          (opts?.includeCancelled || a.status !== "CANCELLED") &&
          (!opts?.fromISO || a.startsAt >= opts.fromISO),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async listClients(businessId: string) {
    return this.clients.filter((c) => c.businessId === businessId);
  }

  async getAppointmentsByPhone(businessId: string, phone: string) {
    const client = await this.findClientByPhone(businessId, phone);
    if (!client) return [];
    return this.appointments
      .filter((a) => a.businessId === businessId && a.clientId === client.id)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "startsAt" | "endsAt" | "status">>,
  ) {
    const appt = this.appointments.find((a) => a.id === id);
    if (!appt) throw new Error("Appointment not found");
    Object.assign(appt, patch);
    return appt;
  }
}
