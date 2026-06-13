import { createHmac, timingSafeEqual } from "crypto";
import { getOptionalSecret } from "./secret";

/**
 * Returning-client recognition. After a booking we set an httpOnly, signed
 * cookie holding the client id; on return the server resolves it to greet them
 * by name. Signed so it can't be tampered to impersonate another client.
 * Degrades gracefully: when no secret is configured (prod without ADMIN_SECRET)
 * we simply skip the cookie rather than break the public booking flow.
 * (Production ties this to real client accounts / verified phone.)
 */
export const CLIENT_COOKIE = "pc_uid";
export const CLIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function mac(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("hex").slice(0, 16);
}

/** Returns the signed cookie value, or null if signing isn't available. */
export function signClientId(id: string): string | null {
  const secret = getOptionalSecret();
  if (!secret) return null;
  return `${id}.${mac(id, secret)}`;
}

export function verifyClientId(value: string | undefined): string | null {
  if (!value) return null;
  const secret = getOptionalSecret();
  if (!secret) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = mac(id, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
