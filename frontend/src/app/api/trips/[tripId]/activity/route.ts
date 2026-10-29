import { and, desc, eq } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { tripActivity, tripMembers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Recent changes on a trip, newest first. Polled by open trips, so it only checks membership and reads one small table. */
export async function GET(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  const viewer = await getViewer();
  const db = getDatabase();
  if (!viewer || viewer.demo || !db || !/^[0-9a-f-]{36}$/i.test(tripId)) return Response.json({ items: [] }, { headers });
  if (viewer.restricted) return Response.json({ error: "Your account has been restricted." }, { status: 403, headers });
  const [member] = await db.select({ userId: tripMembers.userId }).from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, viewer.id))).limit(1);
  if (!member) return Response.json({ error: "Not found" }, { status: 404, headers });
  try {
    const items = await db.select({
      id: tripActivity.id, actorId: tripActivity.actorId, actorName: tripActivity.actorName,
      summary: tripActivity.summary, createdAt: tripActivity.createdAt,
    }).from(tripActivity).where(eq(tripActivity.tripId, tripId)).orderBy(desc(tripActivity.createdAt)).limit(40);
    return Response.json({ items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })) }, { headers });
  } catch {
    // Before the activity migration runs there is simply nothing to show.
    return Response.json({ items: [] }, { headers });
  }
}
