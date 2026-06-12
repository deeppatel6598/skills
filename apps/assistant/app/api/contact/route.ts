import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

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

  // MVP: log it (no PII beyond what they submitted). Wire Resend/DB in the email phase.
  console.log("[contact]", { name: parsed.data.name, email: parsed.data.email, len: parsed.data.message.length });
  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
