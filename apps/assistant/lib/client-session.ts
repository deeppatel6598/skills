import { createHmac, timingSafeEqual } from "crypto";

/**
 * Returning-client recognition. After a booking we set an httpOnly, signed
 * cookie holding the client id; on return the server resolves it to greet them
 * by name. Signed so it can't be tampered to impersonate another client.
 * (Production ties this to real client accounts / verified phone.)
 */
const SECRET = process.env.ADMIN_SECRET || "dev-insecure-secret-change-me";
export const CLIENT_COOKIE = "pc_uid";
export const CLIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function mac(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("hex").slice(0, 16);
}

export function signClientId(id: string): string {
  return `${id}.${mac(id)}`;
}

export function verifyClientId(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = mac(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
