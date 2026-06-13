/**
 * Server secret used to sign admin sessions and the returning-client cookie.
 * Fails closed in production: if ADMIN_SECRET is unset we refuse to fall back to
 * a guessable default (which would let anyone forge an admin session), so the
 * app must be configured with a real secret before it can authenticate anyone.
 */
const DEV_FALLBACK = "dev-insecure-secret-change-me";

export function getServerSecret(): string {
  const s = getOptionalSecret();
  if (s) return s;
  throw new Error("ADMIN_SECRET must be set to a strong value in production.");
}

/**
 * Like getServerSecret but returns null instead of throwing when unset in
 * production. Used for non-security-critical signing (the returning-client
 * cookie) that should degrade gracefully rather than break public flows.
 */
export function getOptionalSecret(): string | null {
  const s = process.env.ADMIN_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") return null;
  return s || DEV_FALLBACK; // dev/test only
}

/** The configured staff password, or null if it must not be used (prod + unset). */
export function getAdminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  if (p) return p;
  if (process.env.NODE_ENV === "production") return null; // disabled until configured
  return "letmein"; // dev/test only
}
