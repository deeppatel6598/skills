import { afterEach, describe, expect, it } from "vitest";
import { getAdminPassword, getServerSecret } from "@/lib/secret";

const orig = {
  env: process.env.NODE_ENV,
  secret: process.env.ADMIN_SECRET,
  pw: process.env.ADMIN_PASSWORD,
};

function restore(key: "NODE_ENV" | "ADMIN_SECRET" | "ADMIN_PASSWORD", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restore("NODE_ENV", orig.env);
  restore("ADMIN_SECRET", orig.secret);
  restore("ADMIN_PASSWORD", orig.pw);
});

describe("server secret (fail-closed)", () => {
  it("uses a dev fallback outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_PASSWORD;
    expect(getServerSecret().length).toBeGreaterThanOrEqual(16);
    expect(getAdminPassword()).toBe("letmein");
  });

  it("refuses guessable defaults in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_PASSWORD;
    expect(() => getServerSecret()).toThrow();
    expect(getAdminPassword()).toBeNull();
  });

  it("uses configured values in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_SECRET = "a-very-long-random-secret-value";
    process.env.ADMIN_PASSWORD = "s3cret-pw";
    expect(getServerSecret()).toBe("a-very-long-random-secret-value");
    expect(getAdminPassword()).toBe("s3cret-pw");
  });
});
