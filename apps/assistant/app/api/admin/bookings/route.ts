import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { loadContext } from "@/lib/context";
import { formatDateTime } from "@/lib/domain/time";
import type { Pet } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/bookings — upcoming appointments as a staff-friendly view. */
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }

  const { repo, business } = await loadContext();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [appts, services, resources, clients] = await Promise.all([
    repo.listAppointments(business.id, { fromISO: startOfToday.toISOString() }),
    repo.listServices(business.id),
    repo.listResources(business.id),
    repo.listClients(business.id),
  ]);

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const data = appts.map((a) => {
    const client = clientById.get(a.clientId);
    const pets = (client?.attributes?.pets ?? []) as Pet[];
    return {
      id: a.id,
      clientName: client?.name ?? "—",
      phone: client?.phone ?? "—",
      petName: pets[0]?.name ?? (a.attributes?.petName as string | undefined) ?? null,
      service: serviceById.get(a.serviceId)?.name ?? "—",
      with: resourceById.get(a.resourceId)?.name ?? "—",
      startISO: a.startsAt,
      when: formatDateTime(a.startsAt),
      status: a.status,
    };
  });

  return NextResponse.json({ data });
}
