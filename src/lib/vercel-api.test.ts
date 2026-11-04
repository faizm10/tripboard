import { describe, expect, it } from "vitest";
import { oidcProject, summarizeDeployments, toDeployment } from "@/lib/vercel-api";

const now = new Date("2026-11-04T18:00:00.000Z");
const at = (iso: string) => Date.parse(iso);

describe("oidcProject", () => {
  const jwt = (claims: object) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

  it("reads the project and team from the token's claims", () => {
    expect(oidcProject(jwt({ project_id: "prj_1", owner_id: "team_1" }))).toEqual({ projectId: "prj_1", teamId: "team_1" });
  });

  it("returns null for missing, malformed, or project-less tokens", () => {
    expect(oidcProject(undefined)).toBeNull();
    expect(oidcProject("not-a-jwt")).toBeNull();
    expect(oidcProject("a.%%%.c")).toBeNull();
    expect(oidcProject(jwt({ owner_id: "team_1" }))).toBeNull();
  });
});

describe("toDeployment", () => {
  it("reads git metadata, the target, and build time for ready builds only", () => {
    const ready = toDeployment({ uid: "dpl_1", url: "a.vercel.app", state: "READY", target: "production", created: at("2026-11-04T10:00:00Z"), buildingAt: 1_000, ready: 61_000, creator: { username: "faizm10" }, meta: { githubCommitRef: "main", githubCommitSha: "abcdef1234", githubCommitMessage: "Ship it\n\nbody" } });
    expect(ready).toMatchObject({ production: true, buildMs: 60_000, branch: "main", commit: "abcdef1", message: "Ship it", creator: "faizm10" });
    expect(toDeployment({ uid: "dpl_2", url: "b", readyState: "ERROR", created: 0, buildingAt: 1, ready: 2 }).buildMs).toBeNull();
  });
});

describe("summarizeDeployments", () => {
  it("counts ready and failed builds per UTC day inside the window", () => {
    const deployments = [
      toDeployment({ uid: "1", url: "", state: "READY", created: at("2026-11-04T09:00:00Z"), buildingAt: 0, ready: 30_000 }),
      toDeployment({ uid: "2", url: "", state: "ERROR", created: at("2026-11-04T08:00:00Z") }),
      toDeployment({ uid: "3", url: "", state: "READY", created: at("2026-11-03T08:00:00Z"), buildingAt: 0, ready: 90_000 }),
      toDeployment({ uid: "4", url: "", state: "READY", created: at("2026-09-01T08:00:00Z"), buildingAt: 0, ready: 1 }),
    ];
    const summary = summarizeDeployments(deployments, 3, now);
    expect(summary).toMatchObject({ total: 3, ready: 2, failed: 1, medianBuildMs: 60_000 });
    expect(summary.successRate).toBeCloseTo(2 / 3);
    expect(summary.daily).toEqual([
      { date: "2026-11-02", ready: 0, failed: 0 },
      { date: "2026-11-03", ready: 1, failed: 0 },
      { date: "2026-11-04", ready: 1, failed: 1 },
    ]);
  });
});
