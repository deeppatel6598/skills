import { describe, expect, it } from "vitest";
import { MemoryRepo } from "@/lib/repo/memory";
import type { Business } from "@/lib/types";
import {
  bookingConfirmationTemplate,
  contactNotificationTemplate,
  emailConfigured,
  notifyBookingConfirmed,
  reminderTemplate,
  sendEmail,
} from "@/lib/email";

const biz = async () => (await new MemoryRepo().getBusinessBySlug("paws-and-care")) as Business;

describe("email", () => {
  it("uses the console outbox when no API key is set", async () => {
    delete process.env.RESEND_API_KEY;
    expect(emailConfigured()).toBe(false);
    const r = await sendEmail({ to: "a@b.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(r).toEqual({ ok: true, provider: "console" });
  });

  it("builds a booking confirmation with details and escapes HTML", async () => {
    const tpl = bookingConfirmationTemplate(await biz(), {
      clientName: "Sara Lopez",
      service: "Wellness Exam",
      when: "Friday at 1:00 PM",
      withName: "Dr. Reyes",
      price: "$65",
      petName: "Bella<x>",
    });
    expect(tpl.subject).toContain("Wellness Exam");
    expect(tpl.text).toContain("Friday at 1:00 PM");
    expect(tpl.html).toContain("Bella&lt;x&gt;"); // escaped
    expect(tpl.html).not.toContain("Bella<x>");
  });

  it("builds reminder and contact templates", async () => {
    const b = await biz();
    expect(reminderTemplate(b, { clientName: "Sara", service: "Vaccination", when: "tomorrow 2pm", withName: "Dr. Patel" }).subject).toContain("Vaccination");
    const c = contactNotificationTemplate(b, { name: "Tom", email: "t@e.com", message: "Hello there" });
    expect(c.text).toContain("t@e.com");
    expect(c.html).toContain("Tom");
  });

  it("notifyBookingConfirmed is a no-op without an address", async () => {
    await expect(
      notifyBookingConfirmed(await biz(), null, { clientName: "X", service: "Y", when: "Z", withName: "W" }),
    ).resolves.toBeUndefined();
  });
});
