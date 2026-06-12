import { describe, expect, it } from "vitest";
import { sessionToken, verifyPassword } from "@/lib/admin-auth";

describe("admin auth", () => {
  it("verifies the configured password (default 'letmein')", () => {
    expect(verifyPassword("letmein")).toBe(true);
    expect(verifyPassword("wrong")).toBe(false);
    expect(verifyPassword("")).toBe(false);
  });

  it("produces a stable, non-empty session token", () => {
    const t = sessionToken();
    expect(t).toHaveLength(64); // sha256 hex
    expect(sessionToken()).toBe(t);
  });
});
