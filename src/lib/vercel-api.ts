import { headers } from "next/headers";
import { envValue } from "@/lib/env";

/**
 * Reads Tripboard's own Vercel project for /admin/platform. Needs
 * VERCEL_API_TOKEN; the project and team come from VERCEL_PROJECT_ID and
 * VERCEL_TEAM_ID when set, otherwise from the claims of the OIDC token Vercel
 * hands every function (see docs/gcp-integration.md → "Platform analytics").
 * Without a token it returns null and the page shows only what the running
 * deployment knows about itself.
 */

const API = "https://api.vercel.com";
const CACHE_MS = 60_000;
export const DEPLOY_DAYS = 30;

export type DeployState = "READY" | "ERROR" | "BUILDING" | "QUEUED" | "INITIALIZING" | "CANCELED";

export type VercelDeployment = {
  id: string;
  url: string;
  state: DeployState;
  production: boolean;
  createdAt: number;
  buildMs: number | null;
  branch: string | null;
  commit: string | null;
  message: string | null;
  creator: string | null;
};

export type VercelReport =
  | {
      ok: true;
      project: { name: string; framework: string | null; nodeVersion: string | null; rootDirectory: string | null; repo: string | null };
      production: VercelDeployment | null;
      deployments: VercelDeployment[];
      domains: { name: string; verified: boolean }[];
      summary: DeploySummary;
      fetchedAt: string;
    }
  | { ok: false; error: string };

export type DeploySummary = {
  total: number;
  ready: number;
  failed: number;
  successRate: number | null;
  medianBuildMs: number | null;
  daily: { date: string; ready: number; failed: number }[];
};

/** Who this server is: filled in by Vercel at runtime, no token needed. */
export function runtimeDeployment() {
  return {
    environment: process.env.VERCEL_ENV ?? "development",
    region: process.env.VERCEL_REGION ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    url: process.env.VERCEL_URL ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
  };
}

/**
 * The project and team this deployment belongs to, read from a Vercel OIDC
 * token's `project_id` and `owner_id` claims. Only the payload is decoded:
 * the IDs pick which project to query, and access still rests on the API token.
 */
export function oidcProject(token: string | null | undefined) {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { project_id?: unknown; owner_id?: unknown };
    if (typeof claims.project_id !== "string") return null;
    return { projectId: claims.project_id, teamId: typeof claims.owner_id === "string" ? claims.owner_id : undefined };
  } catch {
    return null;
  }
}

export async function vercelSettings() {
  const token = envValue("VERCEL_API_TOKEN");
  if (!token) return null;
  let projectId = envValue("VERCEL_PROJECT_ID");
  let teamId = envValue("VERCEL_TEAM_ID");
  if (!projectId) {
    // On Vercel the token arrives as a request header; `vercel env pull` puts one in .env.local for local dev.
    const oidc = oidcProject((await headers()).get("x-vercel-oidc-token") ?? envValue("VERCEL_OIDC_TOKEN"));
    projectId = oidc?.projectId;
    teamId ??= oidc?.teamId;
  }
  if (!projectId) return null;
  return { token, projectId, teamId };
}

type RawDeployment = {
  uid: string;
  url: string;
  state?: DeployState;
  readyState?: DeployState;
  target?: string | null;
  created: number;
  buildingAt?: number;
  ready?: number;
  creator?: { username?: string };
  meta?: Record<string, string | undefined>;
};

export function toDeployment(raw: RawDeployment): VercelDeployment {
  const meta = raw.meta ?? {};
  const state = raw.state ?? raw.readyState ?? "QUEUED";
  return {
    id: raw.uid,
    url: raw.url,
    state,
    production: raw.target === "production",
    createdAt: raw.created,
    buildMs: state === "READY" && raw.ready != null && raw.buildingAt != null ? raw.ready - raw.buildingAt : null,
    branch: meta.githubCommitRef ?? meta.gitlabCommitRef ?? null,
    commit: (meta.githubCommitSha ?? meta.gitlabCommitSha)?.slice(0, 7) ?? null,
    message: (meta.githubCommitMessage ?? meta.gitlabCommitMessage)?.split("\n")[0] ?? null,
    creator: raw.creator?.username ?? null,
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeDeployments(deployments: VercelDeployment[], days = DEPLOY_DAYS, now = new Date()): DeploySummary {
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1 - index))).toISOString().slice(0, 10);
    return { date, ready: 0, failed: 0 };
  });
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const inWindow = deployments.filter((deployment) => byDate.has(new Date(deployment.createdAt).toISOString().slice(0, 10)));
  let ready = 0;
  let failed = 0;
  for (const deployment of inWindow) {
    const day = byDate.get(new Date(deployment.createdAt).toISOString().slice(0, 10))!;
    if (deployment.state === "READY") { ready += 1; day.ready += 1; }
    if (deployment.state === "ERROR") { failed += 1; day.failed += 1; }
  }
  const finished = ready + failed;
  return {
    total: inWindow.length,
    ready,
    failed,
    successRate: finished ? ready / finished : null,
    medianBuildMs: median(inWindow.flatMap((deployment) => (deployment.buildMs === null ? [] : [deployment.buildMs]))),
    daily,
  };
}

export type VercelSettings = NonNullable<Awaited<ReturnType<typeof vercelSettings>>>;

/** GETs a Vercel API path, or POSTs `body` as JSON when one is given. */
export async function vercel<T>(path: string, settings: VercelSettings, params: Record<string, string> = {}, body?: unknown) {
  const query = new URLSearchParams({ ...params, ...(settings.teamId ? { teamId: settings.teamId } : {}) });
  const response = await fetch(`${API}${path}?${query}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${settings.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Vercel answered ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

let cached: { at: number; report: VercelReport } | null = null;

export async function getVercelReport(): Promise<VercelReport | null> {
  const settings = await vercelSettings();
  if (!settings) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
  let report: VercelReport;
  try {
    const since = String(Date.now() - DEPLOY_DAYS * 86_400_000);
    const [project, list, domains] = await Promise.all([
      vercel<{ name: string; framework?: string | null; nodeVersion?: string; rootDirectory?: string | null; link?: { org?: string; repo?: string }; targets?: { production?: RawDeployment } }>(`/v9/projects/${settings.projectId}`, settings),
      vercel<{ deployments: RawDeployment[] }>("/v6/deployments", settings, { projectId: settings.projectId, limit: "100", since }),
      vercel<{ domains: { name: string; verified: boolean }[] }>(`/v9/projects/${settings.projectId}/domains`, settings),
    ]);
    const deployments = list.deployments.map(toDeployment).sort((a, b) => b.createdAt - a.createdAt);
    const productionId = project.targets?.production?.uid;
    report = {
      ok: true,
      project: {
        name: project.name,
        framework: project.framework ?? null,
        nodeVersion: project.nodeVersion ?? null,
        rootDirectory: project.rootDirectory ?? null,
        repo: project.link?.org && project.link.repo ? `${project.link.org}/${project.link.repo}` : null,
      },
      production: deployments.find((deployment) => deployment.id === productionId) ?? (project.targets?.production ? toDeployment(project.targets.production) : null),
      deployments,
      domains: domains.domains.map(({ name, verified }) => ({ name, verified })),
      summary: summarizeDeployments(deployments),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    report = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  cached = { at: Date.now(), report };
  return report;
}
