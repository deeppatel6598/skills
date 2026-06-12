import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, sessionToken, verifyPassword } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  // Throttle brute-force attempts on the staff password.
  const limited = rateLimit(req, { name: "admin-login", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success || !verifyPassword(parsed.data.password)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Incorrect password" } }, { status: 401 });
  }
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}
