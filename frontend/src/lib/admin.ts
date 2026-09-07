import { and, count, desc, eq, gt, gte, ilike, or, sql } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { adminAuditLogs, tripInvitationAcceptances, tripInvitations, tripMembers, tripPlaces, trips } from "@/lib/db/schema";
import { neonAuthSessions, neonAuthUsers } from "@/lib/db/neon-auth-schema";
import { isAdminEmail, type AdminRange, rangeStart } from "@/lib/admin-config";

export { ADMIN_EMAIL_ENV, ADMIN_RANGES, adminRange, isAdminEmail, normalizeAdminEmail, rangeStart, type AdminRange } from "@/lib/admin-config";

export type AdminViewer = { id: string; email: string; name: string };
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  lastActiveAt: Date | null;
  banned: boolean;
  banReason: string | null;
  tripCount: number;
};

export type AdminTrip = {
  id: string;
  title: string;
  destination: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: Date;
  memberCount: number;
  placeCount: number;
};

function number(value: unknown) {
  return Number(value ?? 0);
}

export async function getAdminViewer(): Promise<AdminViewer | null> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || viewer.restricted || !isAdminEmail(viewer.email)) return null;
  return { id: viewer.id, email: viewer.email ?? "", name: viewer.name?.trim() || "Administrator" };
}

export async function requireAdmin() {
  const admin = await getAdminViewer();
  if (!admin) throw new Error("Administrator access is required.");
  return admin;
}

function dateLabels(days: AdminRange) {
  const start = rangeStart(days);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export async function getAdminDashboard(days: AdminRange) {
  await requireAdmin();
  const db = getDatabase();
  if (!db) return null;
  const start = rangeStart(days);
  const now = new Date();

  const [registered, newUsers, activeUsers, newTrips, savedPlaces, invitations, acceptedInvitations] = await Promise.all([
    db.select({ value: count() }).from(neonAuthUsers),
    db.select({ value: count() }).from(neonAuthUsers).where(gte(neonAuthUsers.createdAt, start)),
    db.select({ value: sql<number>`count(distinct ${neonAuthSessions.userId})::int` }).from(neonAuthSessions).where(and(gte(neonAuthSessions.updatedAt, start), gt(neonAuthSessions.expiresAt, now))),
    db.select({ value: count() }).from(trips).where(gte(trips.createdAt, start)),
    db.select({ value: count() }).from(tripPlaces).where(gte(tripPlaces.createdAt, start)),
    db.select({ value: count() }).from(tripInvitations).where(gte(tripInvitations.createdAt, start)),
    db.select({ value: count() }).from(tripInvitationAcceptances).where(gte(tripInvitationAcceptances.acceptedAt, start)),
  ]);

  const collaborative = await db
    .select({ tripId: tripMembers.tripId })
    .from(tripMembers)
    .innerJoin(trips, eq(trips.id, tripMembers.tripId))
    .where(gte(trips.createdAt, start))
    .groupBy(tripMembers.tripId)
    .having(sql`count(*) > 1`);

  const [userTrend, tripTrend, recentUsers, recentTrips, recentInvites] = await Promise.all([
    db.select({ day: sql<string>`to_char(date_trunc('day', ${neonAuthUsers.createdAt}), 'YYYY-MM-DD')`, value: sql<number>`count(*)::int` })
      .from(neonAuthUsers).where(gte(neonAuthUsers.createdAt, start)).groupBy(sql`date_trunc('day', ${neonAuthUsers.createdAt})`).orderBy(sql`date_trunc('day', ${neonAuthUsers.createdAt})`),
    db.select({ day: sql<string>`to_char(date_trunc('day', ${trips.createdAt}), 'YYYY-MM-DD')`, value: sql<number>`count(*)::int` })
      .from(trips).where(gte(trips.createdAt, start)).groupBy(sql`date_trunc('day', ${trips.createdAt})`).orderBy(sql`date_trunc('day', ${trips.createdAt})`),
    db.select({ id: neonAuthUsers.id, name: neonAuthUsers.name, email: neonAuthUsers.email, createdAt: neonAuthUsers.createdAt }).from(neonAuthUsers).orderBy(desc(neonAuthUsers.createdAt)).limit(5),
    db.select({ id: trips.id, title: trips.title, destination: trips.destination, createdAt: trips.createdAt }).from(trips).orderBy(desc(trips.createdAt)).limit(5),
    db.select({ id: tripInvitations.id, email: tripInvitations.email, createdAt: tripInvitations.createdAt, acceptedAt: tripInvitations.acceptedAt }).from(tripInvitations).orderBy(desc(tripInvitations.createdAt)).limit(5),
  ]);

  const userValues = new Map(userTrend.map((row) => [row.day, number(row.value)]));
  const tripValues = new Map(tripTrend.map((row) => [row.day, number(row.value)]));
  const trend = dateLabels(days).map((day) => ({ day, users: userValues.get(day) ?? 0, trips: tripValues.get(day) ?? 0 }));
  const tripsCreated = number(newTrips[0]?.value);
  const invitationCount = number(invitations[0]?.value);

  return {
    days,
    metrics: {
      registered: number(registered[0]?.value),
      newUsers: number(newUsers[0]?.value),
      activeUsers: number(activeUsers[0]?.value),
      newTrips: tripsCreated,
      savedPlaces: number(savedPlaces[0]?.value),
      collaborationRate: tripsCreated ? Math.round((collaborative.length / tripsCreated) * 100) : 0,
      invitationAcceptanceRate: invitationCount ? Math.round((number(acceptedInvitations[0]?.value) / invitationCount) * 100) : 0,
    },
    trend,
    activity: [
      ...recentUsers.map((user) => ({ id: `user-${user.id}`, kind: "New user", title: user.name || "Unnamed user", detail: user.email, createdAt: user.createdAt })),
      ...recentTrips.map((trip) => ({ id: `trip-${trip.id}`, kind: "New trip", title: trip.title, detail: trip.destination, createdAt: trip.createdAt })),
      ...recentInvites.map((invite) => ({ id: `invite-${invite.id}`, kind: invite.acceptedAt ? "Accepted invite" : "Invite sent", title: invite.email || "Share invite", detail: invite.acceptedAt ? "Accepted" : "Awaiting response", createdAt: invite.createdAt })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10),
  };
}

const tripCountForUser = sql<number>`(select count(*)::int from ${tripMembers} where ${tripMembers.userId} = ${neonAuthUsers.id}::text)`;
const lastActiveForUser = sql<Date | null>`(select max(${neonAuthSessions.updatedAt}) from ${neonAuthSessions} where ${neonAuthSessions.userId} = ${neonAuthUsers.id})`;

export async function listAdminUsers(query = "") {
  await requireAdmin();
  const db = getDatabase();
  if (!db) return [];
  const needle = query.trim();
  const condition = needle ? or(ilike(neonAuthUsers.name, `%${needle}%`), ilike(neonAuthUsers.email, `%${needle}%`)) : undefined;
  const rows = await db.select({
    id: neonAuthUsers.id, name: neonAuthUsers.name, email: neonAuthUsers.email, createdAt: neonAuthUsers.createdAt,
    lastActiveAt: lastActiveForUser, banned: neonAuthUsers.banned, banReason: neonAuthUsers.banReason, tripCount: tripCountForUser,
  }).from(neonAuthUsers).where(condition).orderBy(desc(neonAuthUsers.createdAt)).limit(100);
  return rows.map((row) => ({ ...row, tripCount: number(row.tripCount) })) satisfies AdminUser[];
}

export async function getAdminUser(userId: string) {
  await requireAdmin();
  const db = getDatabase();
  if (!db) return null;
  const [user] = await db.select({
    id: neonAuthUsers.id, name: neonAuthUsers.name, email: neonAuthUsers.email, createdAt: neonAuthUsers.createdAt,
    lastActiveAt: lastActiveForUser, banned: neonAuthUsers.banned, banReason: neonAuthUsers.banReason, tripCount: tripCountForUser,
  }).from(neonAuthUsers).where(eq(neonAuthUsers.id, userId)).limit(1);
  if (!user) return null;
  const userTrips = await db.select({ id: trips.id, title: trips.title, destination: trips.destination, createdAt: trips.createdAt })
    .from(tripMembers).innerJoin(trips, eq(trips.id, tripMembers.tripId)).where(eq(tripMembers.userId, userId)).orderBy(desc(trips.createdAt));
  const audit = await db.select({ id: adminAuditLogs.id, action: adminAuditLogs.action, reason: adminAuditLogs.reason, createdAt: adminAuditLogs.createdAt })
    .from(adminAuditLogs).where(eq(adminAuditLogs.targetUserId, userId)).orderBy(desc(adminAuditLogs.createdAt)).limit(10);
  return { user: { ...user, tripCount: number(user.tripCount) } satisfies AdminUser, trips: userTrips, audit };
}

export async function listAdminTrips(query = "") {
  await requireAdmin();
  const db = getDatabase();
  if (!db) return [];
  const needle = query.trim();
  const condition = needle ? or(ilike(trips.title, `%${needle}%`), ilike(trips.destination, `%${needle}%`)) : undefined;
  const rows = await db.select({
    id: trips.id, title: trips.title, destination: trips.destination, ownerId: trips.ownerId, createdAt: trips.createdAt,
    ownerName: sql<string>`coalesce((select ${neonAuthUsers.name} from ${neonAuthUsers} where ${neonAuthUsers.id}::text = ${trips.ownerId}), 'Unknown owner')`,
    ownerEmail: sql<string>`coalesce((select ${neonAuthUsers.email} from ${neonAuthUsers} where ${neonAuthUsers.id}::text = ${trips.ownerId}), '')`,
    memberCount: sql<number>`(select count(*)::int from ${tripMembers} where ${tripMembers.tripId} = ${trips.id})`,
    placeCount: sql<number>`(select count(*)::int from ${tripPlaces} where ${tripPlaces.tripId} = ${trips.id})`,
  }).from(trips).where(condition).orderBy(desc(trips.createdAt)).limit(100);
  return rows.map((row) => ({ ...row, memberCount: number(row.memberCount), placeCount: number(row.placeCount) })) satisfies AdminTrip[];
}
