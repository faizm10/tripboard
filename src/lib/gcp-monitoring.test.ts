import { describe, expect, it } from "vitest";
import { averageUptime, dailyUptime, parseServiceAccount } from "@/lib/gcp-monitoring";

const key = { client_email: "uptime@project.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n" };

describe("parseServiceAccount", () => {
  it("reads raw JSON and base64 JSON, restoring escaped newlines", () => {
    const raw = JSON.stringify(key);
    for (const value of [raw, Buffer.from(raw).toString("base64")]) {
      const account = parseServiceAccount(value);
      expect(account?.client_email).toBe(key.client_email);
      expect(account?.private_key).toContain("\nabc\n");
    }
  });

  it("rejects blanks, junk, and keys missing fields", () => {
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("not json")).toBeNull();
    expect(parseServiceAccount(JSON.stringify({ client_email: "x" }))).toBeNull();
  });
});

describe("dailyUptime", () => {
  const now = new Date("2026-11-04T15:00:00.000Z");

  it("lays points onto the last N UTC days, oldest first, with gaps as null", () => {
    const days = dailyUptime([
      { time: Date.parse("2026-11-04T12:00:00.000Z"), value: 1 },
      { time: Date.parse("2026-11-02T12:00:00.000Z"), value: 0.5 },
    ], 3, now);
    expect(days).toEqual([
      { date: "2026-11-02", uptime: 0.5 },
      { date: "2026-11-03", uptime: null },
      { date: "2026-11-04", uptime: 1 },
    ]);
  });

  it("files a point that ends exactly at midnight under the day it closes", () => {
    const [day] = dailyUptime([{ time: Date.parse("2026-11-04T00:00:00.000Z"), value: 0.9 }], 2, now);
    expect(day).toEqual({ date: "2026-11-03", uptime: 0.9 });
  });

  it("averages only days with data", () => {
    expect(averageUptime([{ date: "a", uptime: 1 }, { date: "b", uptime: null }, { date: "c", uptime: 0.5 }])).toBe(0.75);
    expect(averageUptime([{ date: "a", uptime: null }])).toBeNull();
  });
});
