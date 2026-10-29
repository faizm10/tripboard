import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseUrl, envValue, neonAuthSettings } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("environment values", () => {
  it("treats the vercel placeholder as missing", () => {
    vi.stubEnv("DATABASE_URL", "[SENSITIVE]");
    expect(envValue("DATABASE_URL")).toBeUndefined();
    expect(databaseUrl()).toBeUndefined();
  });

  it("only accepts postgres URLs for the database", () => {
    vi.stubEnv("DATABASE_URL", "not-a-url");
    expect(databaseUrl()).toBeUndefined();
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@host/db");
    expect(databaseUrl()).toBe("postgresql://user:pass@host/db");
  });

  it("turns sign-in off when the cookie secret is too short", () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.com");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "short");
    expect(neonAuthSettings()).toBeNull();
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "x".repeat(32));
    expect(neonAuthSettings()).toEqual({ baseUrl: "https://auth.example.com", secret: "x".repeat(32) });
  });
});
