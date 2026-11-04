export const ADMIN_EMAIL_ENV = "ADMIN_EMAIL";
export const ADMIN_RANGES = [7, 30, 90] as const;
export type AdminRange = (typeof ADMIN_RANGES)[number];

export function normalizeAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAdminEmail(email?: string | null) {
  const configured = normalizeAdminEmail(process.env[ADMIN_EMAIL_ENV]);
  return Boolean(configured) && normalizeAdminEmail(email) === configured;
}

export function adminRange(value?: string | null): AdminRange {
  const parsed = Number(value);
  return ADMIN_RANGES.includes(parsed as AdminRange) ? (parsed as AdminRange) : 30;
}

export function rangeStart(days: AdminRange) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}
