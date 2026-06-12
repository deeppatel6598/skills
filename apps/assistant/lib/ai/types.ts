/** Structured UI hints the concierge can attach to a reply (rendered as chips/cards). */
export type ConciergeUI =
  | { kind: "services"; services: { name: string; price: string | null; durationMin: number; description: string | null }[] }
  | { kind: "slots"; service: string; slots: { iso: string; label: string; with: string }[] }
  | { kind: "booked"; service: string; when: string; with: string; price: string | null }
  | { kind: "collect"; service?: string; startISO?: string };

export interface ConciergeResult {
  reply: string;
  ui?: ConciergeUI;
  usedClaude: boolean;
}
