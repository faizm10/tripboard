"use client";

import { MessageSquare, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { removeAllConversations, removeConversation, updateSaveConversations } from "@/lib/assistant/actions";
import { shortModelName } from "@/lib/assistant/models";
import type { AssistantUsageSummary, ConversationSummary } from "@/lib/assistant/store";

const number = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function AccountAssistant({
  demo,
  saving: initialSaving,
  usage,
  conversations: initialConversations,
}: {
  demo: boolean;
  saving: boolean;
  usage: AssistantUsageSummary;
  conversations: ConversationSummary[];
}) {
  const [saving, setSaving] = useState(initialSaving);
  const [conversations, setConversations] = useState(initialConversations);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleSaving() {
    const next = !saving;
    setSaving(next);
    setError("");
    startTransition(async () => {
      try {
        await updateSaveConversations(next);
      } catch {
        setSaving(!next);
        setError("That setting didn't save. Try again.");
      }
    });
  }

  function deleteOne(id: string) {
    const previous = conversations;
    setConversations((current) => current.filter((item) => item.id !== id));
    startTransition(async () => {
      try {
        await removeConversation(id);
      } catch {
        setConversations(previous);
        setError("That chat couldn't be deleted. Try again.");
      }
    });
  }

  function deleteAll() {
    const previous = conversations;
    setConversations([]);
    setConfirmingClear(false);
    startTransition(async () => {
      try {
        await removeAllConversations();
      } catch {
        setConversations(previous);
        setError("Your chats couldn't be deleted. Try again.");
      }
    });
  }

  return (
    <section className="account-assistant" id="assistant" aria-labelledby="account-assistant-title">
      <header className="account-section-head">
        <span className="assistant-mark" aria-hidden="true"><Sparkles size={16} /></span>
        <div>
          <h2 id="account-assistant-title">Trip assistant</h2>
          <p>How much you&rsquo;ve used the AI, and whether it keeps your chats.</p>
        </div>
      </header>

      <dl className="account-stats">
        <div>
          <dt>Replies, last 30 days</dt>
          <dd>{number.format(usage.replies30d)}</dd>
        </div>
        <div>
          <dt>Tokens, last 30 days</dt>
          <dd title={number.format(usage.tokens30d)}>{compact.format(usage.tokens30d)}</dd>
        </div>
        <div>
          <dt>All time</dt>
          <dd>{number.format(usage.repliesAllTime)} <small>replies</small></dd>
        </div>
      </dl>
      <p className="account-stat-note">
        {usage.lastUsedAt ? `Last used ${formatDate(usage.lastUsedAt)}.` : "You haven't asked the assistant anything yet."}
        {usage.models.length ? ` Mostly answered by ${usage.models.map((item) => shortModelName(item.model)).slice(0, 2).join(" and ")}.` : ""}
        {" "}It runs on free models, so there&rsquo;s nothing to pay. We only count replies and tokens, never what you wrote.
      </p>

      <div className="account-setting">
        <div>
          <strong id="save-chats-label">Save my chats</strong>
          <p>Keep conversations on your account so you can pick them up later, on any device. Off means a chat only lasts until you close the tab.</p>
        </div>
        <button
          aria-checked={saving}
          aria-labelledby="save-chats-label"
          className="account-switch"
          disabled={demo || pending}
          onClick={toggleSaving}
          role="switch"
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="account-chats">
        <div className="account-chats-head">
          <h3>Saved chats</h3>
          {conversations.length ? (
            confirmingClear ? (
              <span className="account-confirm">
                Delete all {conversations.length}?
                <button className="text-danger" disabled={pending} onClick={deleteAll} type="button">Delete</button>
                <button onClick={() => setConfirmingClear(false)} type="button">Cancel</button>
              </span>
            ) : (
              <button className="account-link-button" onClick={() => setConfirmingClear(true)} type="button">Delete all</button>
            )
          ) : null}
        </div>
        {conversations.length ? (
          <ul>
            {conversations.map((item) => (
              <li key={item.id}>
                <MessageSquare size={15} aria-hidden="true" />
                <Link href={`/trips/${item.tripId}`}>
                  <strong>{item.title}</strong>
                  <small>{item.tripTitle} · {formatDate(item.updatedAt)} · {item.messageCount} messages</small>
                </Link>
                <button className="assistant-icon-button" disabled={pending} onClick={() => deleteOne(item.id)} aria-label={`Delete “${item.title}”`} title="Delete chat" type="button"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="account-empty">
            {demo
              ? "Saved chats need a live account."
              : saving
                ? "Nothing saved yet. Ask the assistant on any trip and the chat lands here."
                : "Turn on saving above and your next chats will appear here."}
          </p>
        )}
      </div>
    </section>
  );
}
