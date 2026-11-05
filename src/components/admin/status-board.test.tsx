import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusBoard } from "@/components/admin/status-board";
import type { UptimeReport } from "@/lib/gcp-monitoring";

const health = {
  status: "operational" as const, version: "0.43.0", checkedAt: "2026-11-04T19:00:00.000Z",
  checks: [{ id: "database" as const, label: "Database", status: "operational" as const, probed: true, latencyMs: 40, detail: "Neon Postgres answered." }],
};
const uptime: UptimeReport = {
  ok: true, projectId: "tripboard-ops", fetchedAt: "2026-11-04T19:00:00.000Z",
  checks: [{
    id: "tripboard-app", name: "tripboard-app", target: "https://usetripboard.vercel.app/api/health?scope=app", periodSeconds: 60, regions: 4, current: "up",
    uptime: { day: 1, week: 0.9986, month: null },
    daily: [{ date: "2026-11-03", uptime: null }, { date: "2026-11-04", uptime: 1 }],
  }],
};

describe("StatusBoard", () => {
  afterEach(cleanup);

  it("shows uptime history and hides admin details from the public", () => {
    render(<StatusBoard health={health} uptime={uptime} />);
    expect(screen.getByText("All systems operational")).toBeTruthy();
    expect(screen.getByText("99.86%")).toBeTruthy();
    expect(screen.queryByText("Neon Postgres answered.")).toBeNull();
    expect(screen.queryByText(/scope=app/)).toBeNull();
  });

  it("shows details and a setup hint to admins", () => {
    render(<StatusBoard admin health={health} uptime={null} />);
    expect(screen.getByText("Neon Postgres answered.")).toBeTruthy();
    expect(screen.getByText("Connect Google Cloud Monitoring")).toBeTruthy();
  });
});
