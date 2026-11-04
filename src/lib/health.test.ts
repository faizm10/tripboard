import { describe, expect, it, vi } from "vitest";
import { overallStatus, publicHealth, runHealthChecks, type HealthReport } from "@/lib/health";

describe("overallStatus", () => {
  it("is operational when nothing is failing, even with features switched off", () => {
    expect(overallStatus([{ status: "operational", critical: true }, { status: "not_configured", critical: false }])).toBe("operational");
  });

  it("is degraded when a non-critical check fails or anything is slow", () => {
    expect(overallStatus([{ status: "operational", critical: true }, { status: "down", critical: false }])).toBe("degraded");
    expect(overallStatus([{ status: "degraded", critical: true }])).toBe("degraded");
  });

  it("is down when a critical check is down", () => {
    expect(overallStatus([{ status: "down", critical: true }, { status: "operational", critical: false }])).toBe("down");
  });
});

describe("publicHealth", () => {
  it("drops admin-only detail text", () => {
    const report: HealthReport = {
      status: "degraded", version: "1.0.0", checkedAt: "2026-11-04T00:00:00.000Z",
      checks: [{ id: "schema", label: "Database schema", status: "degraded", probed: true, critical: false, detail: "Missing: trips.secret" }],
    };
    expect(JSON.stringify(publicHealth(report))).not.toContain("trips.secret");
  });
});

describe("runHealthChecks", () => {
  it("answers from the app alone for the app scope", async () => {
    const report = await runHealthChecks({ scope: "app" });
    expect(report.status).toBe("operational");
    expect(report.checks.map((check) => check.id)).toEqual(["app"]);
  });
});

describe("auth probe", () => {
  it("retries once so a cold start isn't reported as an outage", async () => {
    const env = { NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET, DATABASE_URL: process.env.DATABASE_URL };
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
    process.env.NEON_AUTH_COOKIE_SECRET = "x".repeat(32);
    delete process.env.DATABASE_URL;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    try {
      const report = await runHealthChecks();
      expect(report.checks.find((check) => check.id === "auth")?.status).toBe("operational");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(report.status).toBe("operational");
    } finally {
      fetchMock.mockRestore();
      for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
});
