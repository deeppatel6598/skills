import { addMinutes, format } from "date-fns";

/**
 * NOTE (MVP simplification): slots are computed in the server's local time and
 * treated as clinic-local. Production should localise with the tenant's
 * `config.timezone` (e.g. via date-fns-tz/Luxon). Kept simple for the demo.
 */

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

export const atMinutes = (day: Date, minutes: number) => {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return addMinutes(d, minutes);
};

export const slotEnd = (startISO: string, durationMin: number) =>
  addMinutes(new Date(startISO), durationMin).toISOString();

/** "Tue, Jun 16 · 2:30 PM" */
export const formatSlotLabel = (iso: string) =>
  format(new Date(iso), "EEE, MMM d · h:mm a");

export const formatDateTime = (iso: string) =>
  format(new Date(iso), "EEEE, MMMM d 'at' h:mm a");
