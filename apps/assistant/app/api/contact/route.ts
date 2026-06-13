import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { loadContext } from "@/lib/context";
import { contactNotificationTemplate, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  message: z.string().min(5).max(4000),
});

/** POST /api/contact — accept a contact message. Production: forward via Resend. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "contact", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Please check the form and try again." } },
      { status: 422 },
    );
  }

  // Notify the clinic inbox (best-effort; falls back to the console outbox).
  try {
    const { business } = await loadContext();
    const to = process.env.CLINIC_EMAIL || "team@example.com";
    await sendEmail({ to, ...contactNotificationTemplate(business, parsed.data) });
  } catch (err) {
    console.error("contact notification failed", err);
  }
  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
