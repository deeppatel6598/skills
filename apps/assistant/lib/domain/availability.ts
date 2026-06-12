import { Appointment, Business, Repo, Resource, Service } from "@/lib/types";
import { addMinutes } from "date-fns";
import { atMinutes, minutesOfDay } from "./time";

export interface Slot {
  iso: string;
  resourceId: string;
  resourceName: string;
}

const GRID_MIN = 30; // candidate start times every 30 minutes
const LEAD_MIN = 60; // don't offer slots starting within the next hour

function overlapsAny(appts: Appointment[], startISO: string, endISO: string) {
  return appts.some((a) => a.startsAt < endISO && startISO < a.endsAt);
}

/**
 * Compute genuinely-bookable start times for a service across the next `days`,
 * from the resources' weekly availability minus existing appointments.
 * Availability is always derived here — never invented by the assistant.
 */
export async function getAvailableSlots(
  repo: Repo,
  business: Business,
  service: Service,
  opts: { days?: number; max?: number } = {},
): Promise<Slot[]> {
  const days = opts.days ?? 7;
  const max = opts.max ?? 6;
  const now = new Date();
  const earliest = addMinutes(now, LEAD_MIN);

  const resources = await repo.listResources(business.id);
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = addMinutes(windowStart, days * 24 * 60).toISOString();

  // Preload each resource's rules + booked appointments once.
  const ctx = await Promise.all(
    resources.map(async (r) => ({
      resource: r,
      rules: await repo.listAvailabilityRules(r.id),
      appts: await repo.listAppointmentsForResource(r.id, windowStart.toISOString(), windowEnd),
    })),
  );

  const slots: Slot[] = [];
  for (let d = 0; d < days; d++) {
    const day = addMinutes(windowStart, d * 24 * 60);
    const weekday = day.getDay();
    for (const { resource, rules, appts } of ctx) {
      for (const rule of rules.filter((x) => x.weekday === weekday)) {
        for (let m = rule.startMin; m + service.durationMin <= rule.endMin; m += GRID_MIN) {
          const start = atMinutes(day, m);
          if (start < earliest) continue;
          const endISO = addMinutes(start, service.durationMin).toISOString();
          const startISO = start.toISOString();
          if (overlapsAny(appts, startISO, endISO)) continue;
          slots.push({ iso: startISO, resourceId: resource.id, resourceName: resource.name });
        }
      }
    }
  }

  slots.sort((a, b) => a.iso.localeCompare(b.iso));
  // De-duplicate identical times across resources — keep the first offered.
  const seen = new Set<string>();
  const unique = slots.filter((s) => (seen.has(s.iso) ? false : seen.add(s.iso) && true));
  return unique.slice(0, max);
}

/** Is a specific [start, start+duration) free for any qualified resource? */
export async function findFreeResource(
  repo: Repo,
  business: Business,
  service: Service,
  startISO: string,
): Promise<Resource | null> {
  const start = new Date(startISO);
  const endISO = addMinutes(start, service.durationMin).toISOString();
  const weekday = start.getDay();
  const startMin = minutesOfDay(start);
  const endMin = startMin + service.durationMin;

  for (const resource of await repo.listResources(business.id)) {
    const rules = await repo.listAvailabilityRules(resource.id);
    const covered = rules.some(
      (r) => r.weekday === weekday && r.startMin <= startMin && endMin <= r.endMin,
    );
    if (!covered) continue;
    const appts = await repo.listAppointmentsForResource(resource.id, startISO, endISO);
    if (!overlapsAny(appts, startISO, endISO)) return resource;
  }
  return null;
}
