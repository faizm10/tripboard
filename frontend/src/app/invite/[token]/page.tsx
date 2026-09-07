import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Ban, Clock, Mail, Users } from "lucide-react";
import { acceptInvitationForm } from "@/app/trips/actions";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { getInvitePreview } from "@/lib/invite-data";

export const metadata: Metadata = { title: "Trip invitation" };
export const dynamic = "force-dynamic";

function tripCode(destination: string) {
  return destination.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "TRP";
}

function formatExpiry(value: string) {
  return new Date(value).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusCopy(status: "invalid" | "active" | "expired" | "revoked" | "accepted", emailMismatch: boolean) {
  if (emailMismatch) return "This invite is tied to a different email address.";
  if (status === "expired") return "This invite link has expired.";
  if (status === "revoked") return "This invite link was revoked.";
  if (status === "accepted") return "This email invite has already been used.";
  if (status === "invalid") return "This invite link is not valid.";
  return "";
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getViewer();
  const invite = await getInvitePreview(token, viewer);
  const returnTo = `/invite/${encodeURIComponent(token)}`;

  if (invite.found && invite.viewerAlreadyMember && !viewer?.demo) {
    redirect(`/trips/${invite.trip.id}`);
  }

  const blocked = !invite.found || invite.status !== "active" || invite.viewerEmailMismatch;
  const needsAuth = !viewer && invite.found && invite.status === "active";
  const code = invite.found ? tripCode(invite.trip.destination) : "TRP";

  return (
    <main className="invite-page">
      <header><Logo /></header>
      <section className="invite-ticket">
        <div className="invite-stub">
          <span>Trip invitation</span>
          <strong>{code}</strong>
          <small>{invite.found ? invite.trip.dateLabel : "Unavailable"}</small>
        </div>
        <div className="invite-main">
          {blocked ? <Ban size={25} /> : invite.found && invite.kind === "email" ? <Mail size={25} /> : <Users size={25} />}
          <p className="eyebrow">
            {invite.found ? `${invite.invitedBy} invited you` : "Invite unavailable"}
          </p>
          <h1>
            {invite.found ? "Help plan" : "Invite not found"}
            <br />
            {invite.found ? invite.trip.title : "This trip."}
          </h1>
          <p>
            {invite.found
              ? invite.kind === "email"
                ? `This invite is for ${invite.email}. Join to save places and edit the shared plan.`
                : "Anyone with this link can join the trip as an editor before it expires."
              : "Ask the trip owner for a fresh invite link."}
          </p>

          {needsAuth ? (
            <div className="invite-actions">
              <Link className="button button-ink" href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
                Sign in to join <ArrowRight size={17} />
              </Link>
              <Link className="button button-paper" href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`}>
                Create account
              </Link>
            </div>
          ) : invite.demo ? (
            <Link className="button button-ink" href={viewer && !viewer.demo ? "/trips" : "/"}>
              {viewer && !viewer.demo ? "Go to your trips" : "Start a trip"} <ArrowRight size={17} />
            </Link>
          ) : blocked ? (
            <div className="invite-status-card" role="alert">
              {statusCopy(invite.found ? invite.status : "invalid", invite.found ? invite.viewerEmailMismatch : false)}
            </div>
          ) : (
            <form action={acceptInvitationForm} className="invite-actions">
              <input name="token" type="hidden" value={token} />
              <button className="button button-ink" type="submit">
                Join the trip <ArrowRight size={17} />
              </button>
            </form>
          )}

          {invite.found ? (
            <small className="invite-expiry">
              <Clock size={12} /> Expires {formatExpiry(invite.expiresAt)}
            </small>
          ) : null}
        </div>
      </section>
    </main>
  );
}
