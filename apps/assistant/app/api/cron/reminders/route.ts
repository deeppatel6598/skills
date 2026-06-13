import { NextRequest, NextResponse } from "next/server";
import { loadContext } from "@/lib/context";
import { formatDateTime } from "@/lib/domain/time";
import { reminderTemplate, sendEmail } from "@/lib/email";
import type { Pet } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Idempotency for the demo (per-process). Production should persist a
// reminderSentAt flag on the appointment so it survives restarts/instances.
const reminded = new Set<string>();

/**
 * GET /api/cron/reminders — sends a reminder for appointments ~24h out.
 * Protect with CRON_SECRET (Authorization: Bearer <secret> or ?key=<secret>);
 * wire to a scheduler (e.g. Vercel Cron) to run hourly.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(req.url).searchParams.get("key");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Bad cron secret" } }, { status: 401 });
  }

  const { repo, business } = await loadContext();
  const now = Date.now();
  const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString();

  const [appts, services, resources, clients] = await Promise.all([
    repo.listAppointments(business.id, { fromISO: new Date(now).toISOString() }),
    repo.listServices(business.id),
    repo.listResources(business.id),
    repo.listClients(business.id),
  ]);
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  let sent = 0;
  for (const a of appts) {
    if (a.status !== "CONFIRMED") continue;
    if (a.startsAt < windowStart || a.startsAt > windowEnd) continue;
    if (reminded.has(a.id)) continue;
    const client = clientById.get(a.clientId);
    if (!client?.email) continue;

    const pets = (client.attributes?.pets ?? []) as Pet[];
    await sendEmail({
      to: client.email,
      ...reminderTemplate(business, {
        clientName: client.name,
        service: serviceById.get(a.serviceId)?.name ?? "your appointment",
        when: formatDateTime(a.startsAt),
        withName: resourceById.get(a.resourceId)?.name ?? "our team",
        petName: pets[0]?.name ?? null,
      }),
    });
    reminded.add(a.id);
    sent += 1;
  }

  return NextResponse.json({ data: { reminded: sent } });
}
