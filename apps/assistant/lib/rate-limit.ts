import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight fixed-window rate limiter (in-memory, per-process). Good enough to
 * blunt brute-force and abuse on a single instance; production behind multiple
 * instances should use a shared store (Upstash Redis) — same interface.
 */
type Bucket = { count: number; reset: number };
const store = new Map<string, Bucket>();

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Returns a 429 NextResponse if the caller is over the limit, else null. */
export function rateLimit(
  req: NextRequest,
  opts: { name: string; limit: number; windowMs: number },
): NextResponse | null {
  const now = Date.now();

  // Opportunistic prune so the map can't grow unbounded.
  if (store.size > 5000) {
    for (const [k, b] of store) if (now > b.reset) store.delete(k);
  }

  const key = `${opts.name}:${clientIp(req)}`;
  const b = store.get(key);

  if (!b || now > b.reset) {
    store.set(key, { count: 1, reset: now + opts.windowMs });
    return null;
  }
  if (b.count >= opts.limit) {
    const retryAfter = Math.ceil((b.reset - now) / 1000);
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  b.count += 1;
  return null;
}
