import type { getAdminDashboard } from "@/lib/admin";

export type AwaitedAdminDashboard = NonNullable<Awaited<ReturnType<typeof getAdminDashboard>>>;
export type AdminRange = AwaitedAdminDashboard["days"];
