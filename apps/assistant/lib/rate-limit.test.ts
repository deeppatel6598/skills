import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const req = (ip: string) => ({ headers: new Headers({ "x-forwarded-for": ip }) }) as unknown as NextRequest;

describe("rate limiter", () => {
  it("allows up to the limit, then returns 429", () => {
    const opts = { name: "unit-a", limit: 3, windowMs: 60_000 };
    expect(rateLimit(req("9.9.9.9"), opts)).toBeNull();
    expect(rateLimit(req("9.9.9.9"), opts)).toBeNull();
    expect(rateLimit(req("9.9.9.9"), opts)).toBeNull();
    const blocked = rateLimit(req("9.9.9.9"), opts);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });

  it("tracks each client IP independently", () => {
    const opts = { name: "unit-b", limit: 1, windowMs: 60_000 };
    expect(rateLimit(req("1.1.1.1"), opts)).toBeNull();
    expect(rateLimit(req("2.2.2.2"), opts)).toBeNull(); // different IP, fresh budget
    expect(rateLimit(req("1.1.1.1"), opts)).not.toBeNull(); // same IP, over limit
  });
});
