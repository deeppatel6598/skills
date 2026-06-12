import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Minimal staff auth for the MVP admin: a shared password gate that sets an
 * httpOnly, SameSite=Strict session cookie (security-review skill). Production
 * swaps this for Auth.js (email magic-link) + per-user roles — the route guard
 * stays the same.
 */
const SECRET = process.env.ADMIN_SECRET || "dev-insecure-secret-change-me";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "letmein";
export const ADMIN_COOKIE = "admin_session";
export const ADMIN_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Opaque, non-guessable session value derived from the server secret. */
export function sessionToken(): string {
  return createHmac("sha256", SECRET).update("admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyPassword(input: string): boolean {
  return safeEqual(input, ADMIN_PASSWORD);
}

export function isAuthed(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(token && safeEqual(token, sessionToken()));
}
