import type { Business } from "@/lib/types";

/**
 * Email layer. Sends via Resend when RESEND_API_KEY is set; otherwise logs to a
 * console "outbox" and returns ok, so the booking flow's "we'll email you"
 * promise works end-to-end with zero setup and is fully testable. Resend is
 * called over plain fetch (no SDK dependency). External send happens outside any
 * DB transaction (prisma-patterns) and is best-effort — it never blocks a booking.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  ok: boolean;
  provider: "resend" | "console";
  id?: string;
  error?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Paws & Care <onboarding@resend.dev>";

  if (!key) {
    console.log(`[email:outbox] to=${msg.to} subject=${JSON.stringify(msg.subject)}`);
    return { ok: true, provider: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      return { ok: false, provider: "resend", error: `resend ${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, provider: "resend", id: json.id };
  } catch (err) {
    return { ok: false, provider: "resend", error: err instanceof Error ? err.message : "send failed" };
  }
}

// ── Templates ───────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(business: Business, heading: string, bodyHtml: string): string {
  const primary = business.config.branding.primary;
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <div style="background:${esc(primary)};color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
    <div style="font-size:18px;font-weight:600">${esc(business.config.branding.bubbleEmoji ?? "🐾")} ${esc(business.name)}</div>
  </div>
  <div style="border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px;padding:22px">
    <h2 style="margin:0 0 12px;font-size:18px">${esc(heading)}</h2>
    ${bodyHtml}
  </div>
</div>`;
}

export interface BookingEmailData {
  clientName: string;
  service: string;
  when: string;
  withName: string;
  price?: string | null;
  petName?: string | null;
}

export function bookingConfirmationTemplate(business: Business, d: BookingEmailData): Omit<EmailMessage, "to"> {
  const first = d.clientName.split(" ")[0];
  const subject = `Your ${d.service} is booked — ${business.name}`;
  const lines = [
    `<p style="margin:0 0 12px">Hi ${esc(first)}, you're all set${d.petName ? ` for ${esc(d.petName)}` : ""}. Here are the details:</p>`,
    `<table style="font-size:14px;line-height:1.6">
      <tr><td style="color:#666;padding-right:12px">Service</td><td><strong>${esc(d.service)}</strong></td></tr>
      <tr><td style="color:#666;padding-right:12px">When</td><td><strong>${esc(d.when)}</strong></td></tr>
      <tr><td style="color:#666;padding-right:12px">With</td><td>${esc(d.withName)}</td></tr>
      ${d.price ? `<tr><td style="color:#666;padding-right:12px">Estimated cost</td><td>${esc(d.price)}</td></tr>` : ""}
    </table>`,
    business.config.policies?.length ? `<p style="margin:16px 0 0;color:#666;font-size:13px">${esc(business.config.policies[0])}</p>` : "",
  ].join("");
  const text = `Hi ${first}, you're all set${d.petName ? ` for ${d.petName}` : ""}.\n\nService: ${d.service}\nWhen: ${d.when}\nWith: ${d.withName}${d.price ? `\nEstimated cost: ${d.price}` : ""}\n\n— ${business.name}`;
  return { subject, html: shell(business, "Appointment confirmed ✓", lines), text };
}

export function reminderTemplate(business: Business, d: BookingEmailData): Omit<EmailMessage, "to"> {
  const first = d.clientName.split(" ")[0];
  const subject = `Reminder: your ${d.service} tomorrow — ${business.name}`;
  const html = shell(
    business,
    "A friendly reminder 🐾",
    `<p style="margin:0 0 12px">Hi ${esc(first)}, just a gentle reminder${d.petName ? ` about ${esc(d.petName)}'s visit` : ""}:</p>
     <p style="font-size:14px"><strong>${esc(d.service)}</strong> — ${esc(d.when)} with ${esc(d.withName)}.</p>
     <p style="margin:16px 0 0;color:#666;font-size:13px">Need to change it? Just reply or call us.</p>`,
  );
  const text = `Hi ${first}, a reminder about your ${d.service} on ${d.when} with ${d.withName}.\n— ${business.name}`;
  return { subject, html, text };
}

export function contactNotificationTemplate(
  business: Business,
  d: { name: string; email: string; message: string },
): Omit<EmailMessage, "to"> {
  const subject = `New contact message from ${d.name}`;
  const html = shell(
    business,
    "New website message",
    `<table style="font-size:14px;line-height:1.6">
      <tr><td style="color:#666;padding-right:12px">From</td><td><strong>${esc(d.name)}</strong></td></tr>
      <tr><td style="color:#666;padding-right:12px">Email</td><td>${esc(d.email)}</td></tr>
     </table>
     <p style="margin:14px 0 0;white-space:pre-wrap;font-size:14px">${esc(d.message)}</p>`,
  );
  const text = `From: ${d.name} <${d.email}>\n\n${d.message}`;
  return { subject, html, text };
}

// ── Best-effort senders (never throw into the caller) ───────────────────────

/** Send a booking confirmation if we have an address. Best-effort. */
export async function notifyBookingConfirmed(
  business: Business,
  to: string | undefined | null,
  data: BookingEmailData,
): Promise<void> {
  if (!to) return;
  try {
    await sendEmail({ to, ...bookingConfirmationTemplate(business, data) });
  } catch (err) {
    console.error("booking confirmation email failed", err);
  }
}
