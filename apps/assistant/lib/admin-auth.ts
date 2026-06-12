import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { getAdminPassword, getServerSecret } from "./secret";

/**
 * Minimal staff auth for the MVP admin: a shared password gate that sets an
 * httpOnly, SameSite=Strict session cookie (security-review skill). Production
 * swaps this for Auth.js (email magic-link) + per-user roles — the route guard
 * stays the same. Secrets fail closed in production (see ./secret).
 */
export const ADMIN_COOKIE = "admin_session";
export const ADMIN_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Opaque, non-guessable session value derived from the server secret. */
export function sessionToken(): string {
  return createHmac("sha256", getServerSecret()).update("admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyPassword(input: string): boolean {
  const password = getAdminPassword();
  if (!password) return false; // admin login disabled until ADMIN_PASSWORD is set (prod)
  return safeEqual(input, password);
}

export function isAuthed(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(token && safeEqual(token, sessionToken()));
}
