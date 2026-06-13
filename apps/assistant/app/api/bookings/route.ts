import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadContext } from "@/lib/context";
import { bookAppointment } from "@/lib/domain/booking";
import { formatDateTime } from "@/lib/domain/time";
import { ConflictError, NotFoundError } from "@/lib/types";
import { CLIENT_COOKIE, CLIENT_COOKIE_MAX_AGE, signClientId } from "@/lib/client-session";
import { rateLimit } from "@/lib/rate-limit";
import { notifyBookingConfirmed } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  clientName: z.string().min(1).max(120),
  phone: z.string().min(7).max(32),
  email: z.string().email().optional(),
  petName: z.string().max(80).optional(),
  petSpecies: z.string().max(80).optional(),
  serviceName: z.string().min(1),
  startISO: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

/** POST /api/bookings — structured booking (used by the widget's booking form). */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "bookings", limit: 15, windowMs: 60_000 });
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
      { error: { code: "validation_error", message: "Please check the form", details: parsed.error.issues } },
      { status: 422 },
    );
  }

  const { repo, business } = await loadContext();
  const b = parsed.data;
  try {
    const result = await bookAppointment(repo, business, {
      clientName: b.clientName,
      phone: b.phone,
      email: b.email,
      pet: b.petName ? { name: b.petName, species: b.petSpecies } : undefined,
      serviceName: b.serviceName,
      startISO: b.startISO,
      reason: b.reason,
    });
    const when = formatDateTime(result.appointment.startsAt);
    const price = result.service.priceCents != null ? `$${(result.service.priceCents / 100).toFixed(0)}` : null;
    const res = NextResponse.json(
      {
        data: {
          id: result.appointment.id,
          service: result.service.name,
          when,
          with: result.resource.name,
          price,
        },
      },
      { status: 201, headers: { Location: `/api/bookings/${result.appointment.id}` } },
    );
    // Remember this client so we can greet them by name next time (signed, httpOnly).
    // Skipped gracefully if no signing secret is configured.
    const signed = signClientId(result.client.id);
    if (signed) {
      res.cookies.set(CLIENT_COOKIE, signed, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: CLIENT_COOKIE_MAX_AGE,
      });
    }
    // Confirmation email (best-effort; doesn't block the booking).
    await notifyBookingConfirmed(business, b.email, {
      clientName: b.clientName,
      service: result.service.name,
      when,
      withName: result.resource.name,
      price,
      petName: b.petName ?? null,
    });
    return res;
  } catch (err) {
    if (err instanceof ConflictError)
      return NextResponse.json({ error: { code: "slot_taken", message: err.message } }, { status: 409 });
    if (err instanceof NotFoundError)
      return NextResponse.json({ error: { code: "not_found", message: err.message } }, { status: 404 });
    console.error("booking error", err);
    return NextResponse.json({ error: { code: "internal_error", message: "Could not book. Please try again." } }, { status: 500 });
  }
}
