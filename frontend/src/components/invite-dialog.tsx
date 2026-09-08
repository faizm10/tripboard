"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Link2, Mail, Trash2, X } from "lucide-react";
import {
  createEmailInvite,
  createShareInvite,
  listTripInvites,
  revokeInvite,
} from "@/app/trips/actions";
import type { TripInvitationSummary } from "@/lib/types";

type InviteMode = "email" | "share";
type InviteResult = { inviteUrl: string; expiresAt: string; demo: boolean; id?: string };
const DEMO_INVITE: InviteResult = {
  inviteUrl: "/invite/demo-nyc-board",
  expiresAt: "2099-01-01T00:00:00.000Z",
  demo: true,
};

function absoluteInviteUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${window.location.origin}${path}`;
}

function formatExpiry(value: string) {
  return new Date(value).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function InviteDialog({
  demo,
  onClose,
  tripId,
}: {
  demo: boolean;
  onClose: () => void;
  tripId: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<InviteMode>("email");
  const [email, setEmail] = useState("");
  const [generated, setGenerated] = useState<InviteResult | null>(null);
  const [invites, setInvites] = useState<TripInvitationSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const shownInvite = generated ?? (demo ? DEMO_INVITE : null);

  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    listTripInvites({ tripId })
      .then((result) => {
        if (!active) return;
        setInvites(result.invites);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Invites could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [demo, tripId]);

  async function copyInvite(path: string) {
    await navigator.clipboard?.writeText(absoluteInviteUrl(path));
    setMessage("Link copied");
    window.setTimeout(() => setMessage(""), 1800);
  }

  async function generateInvite() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        await copyInvite(DEMO_INVITE.inviteUrl);
        return;
      }
      const result = mode === "email"
        ? await createEmailInvite({ tripId, email })
        : await createShareInvite({ tripId });
      setGenerated(result);
      await copyInvite(result.inviteUrl);
      if (!result.demo) {
        const refreshed = await listTripInvites({ tripId });
        setInvites(refreshed.invites);
      }
      if (mode === "email") setEmail("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invite link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitationId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await revokeInvite({ tripId, invitationId });
      setInvites((current) => current.filter((invite) => invite.id !== invitationId));
      setMessage("Invite revoked");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invite could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="invite-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="invite-title" tabIndex={-1}>
        <header>
          <div>
            <p className="eyebrow">Invite people</p>
            <h2 id="invite-title">Share this trip.</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close invites" type="button"><X size={18} /></button>
        </header>

        <div className="invite-mode" role="tablist" aria-label="Invite type">
          <button className={mode === "email" ? "active" : ""} onClick={() => setMode("email")} role="tab" aria-selected={mode === "email"} type="button"><Mail size={14} /> Invite by email</button>
          <button className={mode === "share" ? "active" : ""} onClick={() => setMode("share")} role="tab" aria-selected={mode === "share"} type="button"><Link2 size={14} /> Share link</button>
        </div>

        <div className="invite-create-panel">
          {mode === "email" ? (
            <label className="field-label" htmlFor="invite-email">
              <span>Email</span>
              <input
                autoComplete="email"
                id="invite-email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="friend@email.com"
                spellCheck={false}
                type="email"
                value={email}
              />
            </label>
          ) : (
            <p>Anyone with the generated link can join as an editor until it expires.</p>
          )}
          <button className="button button-ink button-full" disabled={busy || (!demo && mode === "email" && !email.trim())} onClick={generateInvite} type="button">
            {busy ? "Working..." : mode === "email" ? "Generate email invite" : "Generate share link"}
          </button>
        </div>

        {shownInvite ? (
          <div className="generated-invite">
            <div>
              <small>{shownInvite.demo ? "Demo link" : "New invite link"}</small>
              <strong>{absoluteInviteUrl(shownInvite.inviteUrl)}</strong>
              {shownInvite.demo ? <span>Static demo invite</span> : <span>Expires {formatExpiry(shownInvite.expiresAt)}</span>}
            </div>
            <button onClick={() => copyInvite(shownInvite.inviteUrl)} type="button"><Copy size={14} /> Copy</button>
          </div>
        ) : null}

        {message ? <p className="invite-message" role="status">{message}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <section className="pending-invites">
          <div className="pending-invites-heading">
            <p className="eyebrow">Active invites</p>
            <span>{invites.length} pending</span>
          </div>
          {demo ? (
            <p className="invite-empty">Demo mode uses one static invite link.</p>
          ) : invites.length ? (
            invites.map((invite) => (
              <article className="pending-invite" key={invite.id}>
                <div>
                  <strong>{invite.kind === "email" ? invite.email : "Share link"}</strong>
                  <small>{invite.kind === "email" ? "Email invite" : "Open invite"} · expires {formatExpiry(invite.expiresAt)}</small>
                </div>
                <button disabled={busy} onClick={() => revoke(invite.id)} type="button"><Trash2 size={13} /> Revoke</button>
              </article>
            ))
          ) : (
            <p className="invite-empty">No active invite links yet.</p>
          )}
        </section>
      </section>
    </div>
  );
}
