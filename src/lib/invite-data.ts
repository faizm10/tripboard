import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { tripInvitations, tripMembers, trips } from "@/lib/db/schema";
import { formatDateLabel } from "@/lib/dates";
import { hashInviteToken, inviteStatus } from "@/lib/invitations";

export type InvitePreview =
  | {
      found: false;
      status: "invalid";
      demo: boolean;
    }
  | {
      found: true;
      status: "active" | "expired" | "revoked" | "accepted";
      demo: boolean;
      invitationId: string;
      kind: "email" | "share";
      email: string | null;
      expiresAt: string;
      invitedBy: string;
      trip: {
        id: string;
        title: string;
        destination: string;
        dateLabel: string;
      };
      viewerAlreadyMember: boolean;
      viewerEmailMismatch: boolean;
    };

export async function getInvitePreview(
  token: string,
  viewer?: { id: string; email?: string | null; demo?: boolean } | null,
): Promise<InvitePreview> {
  if (token === "demo-nyc-board") {
    return {
      found: true,
      status: "active",
      demo: true,
      invitationId: "demo-invite",
      kind: "share",
      email: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
      invitedBy: "Faiz",
      trip: {
        id: "nyc-weekender",
        title: "New York, loosely",
        destination: "New York",
        dateLabel: "APR 10-13",
      },
      viewerAlreadyMember: false,
      viewerEmailMismatch: false,
    };
  }

  const db = getDatabase();
  if (!db) {
    return {
      found: true,
      status: "active",
      demo: true,
      invitationId: "demo-invite",
      kind: "share",
      email: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      invitedBy: "Faiz",
      trip: {
        id: "nyc-weekender",
        title: "New York, loosely",
        destination: "New York",
        dateLabel: "APR 10-13",
      },
      viewerAlreadyMember: false,
      viewerEmailMismatch: false,
    };
  }

  const [invitation] = await db
    .select()
    .from(tripInvitations)
    .where(eq(tripInvitations.tokenHash, hashInviteToken(token)))
    .limit(1);
  if (!invitation) return { found: false, status: "invalid", demo: false };

  const [trip] = await db
    .select({
      id: trips.id,
      title: trips.title,
      destination: trips.destination,
      startDate: trips.startDate,
      endDate: trips.endDate,
    })
    .from(trips)
    .where(eq(trips.id, invitation.tripId))
    .limit(1);
  if (!trip) return { found: false, status: "invalid", demo: false };

  const [inviter] = await db
    .select({ displayName: tripMembers.displayName })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, invitation.tripId), eq(tripMembers.userId, invitation.invitedBy)))
    .limit(1);

  const [membership] = viewer && !viewer.demo
    ? await db
      .select({ userId: tripMembers.userId })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, invitation.tripId), eq(tripMembers.userId, viewer.id)))
      .limit(1)
    : [];
  const viewerAlreadyMember = Boolean(membership);
  const status = inviteStatus(invitation);
  const viewerEmailMismatch = Boolean(
    viewer &&
    !viewerAlreadyMember &&
    invitation.kind === "email" &&
    viewer.email?.toLowerCase() !== invitation.email?.toLowerCase(),
  );

  return {
    found: true,
    status,
    demo: false,
    invitationId: invitation.id,
    kind: invitation.kind,
    email: invitation.email,
    expiresAt: invitation.expiresAt.toISOString(),
    invitedBy: inviter?.displayName || "A traveler",
    trip: {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      dateLabel: formatDateLabel(
        trip.startDate ? String(trip.startDate).slice(0, 10) : "",
        trip.endDate ? String(trip.endDate).slice(0, 10) : "",
      ),
    },
    viewerAlreadyMember,
    viewerEmailMismatch,
  };
}
