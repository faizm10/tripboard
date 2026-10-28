"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowLeft,
  ArrowUp,
  BedDouble,
  CalendarDays,
  Check,
  Coffee,
  ExternalLink,
  History,
  Landmark,
  MapPin,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  TramFront,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { loadConversation, loadTripConversations, removeConversation } from "@/lib/assistant/actions";
import { shortModelName } from "@/lib/assistant/models";
import type { ConversationSummary } from "@/lib/assistant/store";
import type { AssistantMessage, AssistantPick } from "@/lib/assistant/tools";
import { categoryClass, isPersistedTripId, type PlaceCategory } from "@/lib/types";

const categoryIcons = {
  Eat: Utensils,
  Drink: Coffee,
  See: Landmark,
  Shop: ShoppingBag,
  Stay: BedDouble,
  Transit: TramFront,
  Other: MapPin,
} satisfies Record<PlaceCategory, typeof MapPin>;

export type AssistantTripSummary = {
  id: string;
  title: string;
  destination: string;
  hotelName?: string;
  firstDate?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  trip: AssistantTripSummary;
  viewerName?: string;
  signedIn: boolean;
  savedPlaceIds: Set<string>;
  onAddPlace: (pick: AssistantPick) => void;
};

type Session = { id: string; messages: AssistantMessage[] };

function storageKey(tripId: string) {
  return `tripboard:assistant:${tripId}`;
}

function newSession(): Session {
  return { id: crypto.randomUUID(), messages: [] };
}

function readStoredSession(tripId: string): Session {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey(tripId)) ?? "null") as Partial<Session> | null;
    if (parsed && typeof parsed.id === "string" && Array.isArray(parsed.messages)) return { id: parsed.id, messages: parsed.messages };
  } catch {
    // fall through to a fresh chat
  }
  return newSession();
}

function writeStoredSession(tripId: string, session: Session) {
  try {
    window.sessionStorage.setItem(storageKey(tripId), JSON.stringify({ id: session.id, messages: session.messages.slice(-40) }));
  } catch {
    // Private windows can refuse storage; the chat still works for this visit.
  }
}

/** Non-2xx responses arrive as the raw JSON body; stream errors arrive as plain text. */
function errorText(error: Error) {
  try {
    const body = JSON.parse(error.message) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // not JSON
  }
  return error.message || "Something went wrong. Try again.";
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function formatWhen(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function starterPrompts(trip: AssistantTripSummary) {
  const city = trip.destination.split(",")[0]?.trim() || trip.destination;
  return [
    "What's missing from my plan?",
    trip.hotelName ? `Dinner spots near ${trip.hotelName}` : `A great dinner spot in ${city}`,
    trip.firstDate ? `Fill my first day in ${city}` : `Must-sees in ${city}`,
    "A plan for a rainy afternoon",
  ];
}

export function TripAssistant(props: Props) {
  // Mount the chat on first open, so its sessionStorage restore runs only in the browser
  // and the conversation survives closing the panel.
  const [mounted, setMounted] = useState(props.open);
  if (props.open && !mounted) setMounted(true);

  return (
    <>
      <div className={`assistant-backdrop${props.open ? " open" : ""}`} onClick={props.onClose} aria-hidden="true" />
      <aside
        className={`assistant-panel${props.open ? " open" : ""}`}
        aria-label="Trip assistant"
        aria-hidden={!props.open}
        inert={!props.open}
      >
        {mounted ? (props.signedIn ? <AssistantChat {...props} /> : <AssistantSignIn onClose={props.onClose} />) : null}
      </aside>
    </>
  );
}

function PanelHeader({ subtitle, onClose, actions }: { subtitle: string; onClose: () => void; actions?: React.ReactNode }) {
  return (
    <header className="assistant-header">
      <span className="assistant-grabber" aria-hidden="true" />
      <span className="assistant-mark" aria-hidden="true"><Sparkles size={16} /></span>
      <div className="assistant-title">
        <strong>Trip assistant</strong>
        <span>{subtitle}</span>
      </div>
      {actions}
      <button className="assistant-icon-button" onClick={onClose} aria-label="Close assistant" type="button"><X size={18} /></button>
    </header>
  );
}

function AssistantSignIn({ onClose }: { onClose: () => void }) {
  return (
    <>
      <PanelHeader subtitle="Plans with you, on any trip" onClose={onClose} />
      <div className="assistant-empty">
        <span className="assistant-empty-mark"><Sparkles size={22} /></span>
        <h2>Sign in to ask the assistant</h2>
        <p>It reads your trip, finds real places nearby and suggests what to add, one tap at a time.</p>
        <Link className="button button-ink" href="/sign-in">Sign in</Link>
      </div>
    </>
  );
}

/** Owns which conversation is open and the saved-chat history; each conversation gets its own chat instance. */
function AssistantChat(props: Props) {
  const { trip, onClose, open } = props;
  const [session, setSession] = useState<Session>(() => readStoredSession(trip.id));
  const [view, setView] = useState<"chat" | "history">("chat");
  const canSave = isPersistedTripId(trip.id);
  const [history, setHistory] = useState<{ saving: boolean; conversations: ConversationSummary[] } | null>(
    () => (canSave ? null : { saving: false, conversations: [] }),
  );
  const [historyError, setHistoryError] = useState("");

  const refreshHistory = useCallback(async () => {
    if (!canSave) return;
    try {
      setHistory(await loadTripConversations(trip.id));
      setHistoryError("");
    } catch {
      setHistoryError("Saved chats couldn't load right now.");
    }
  }, [canSave, trip.id]);

  useEffect(() => {
    if (!canSave) return;
    let cancelled = false;
    loadTripConversations(trip.id)
      .then((loaded) => !cancelled && setHistory(loaded))
      .catch(() => !cancelled && setHistoryError("Saved chats couldn't load right now."));
    return () => {
      cancelled = true;
    };
  }, [canSave, trip.id]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (view === "history") setView("chat");
      else onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose, view]);

  function startNew() {
    const next = newSession();
    writeStoredSession(trip.id, next);
    setSession(next);
    setView("chat");
  }

  async function openSaved(id: string) {
    const messages = await loadConversation(id).catch(() => null);
    if (!messages) {
      setHistoryError("That chat couldn't be opened. It may have been deleted.");
      void refreshHistory();
      return;
    }
    const next = { id, messages };
    writeStoredSession(trip.id, next);
    setSession(next);
    setView("chat");
  }

  async function deleteSaved(id: string) {
    setHistory((current) => current && { ...current, conversations: current.conversations.filter((item) => item.id !== id) });
    await removeConversation(id).catch(() => setHistoryError("That chat couldn't be deleted. Try again."));
    if (id === session.id) startNew();
  }

  const headerActions = view === "history" ? null : (
    <>
      <button className="assistant-icon-button" onClick={() => { setView("history"); void refreshHistory(); }} aria-label="Chat history" title="Chat history" type="button"><History size={17} /></button>
      <button className="assistant-icon-button" onClick={startNew} aria-label="Start a new chat" title="New chat" type="button"><SquarePen size={16} /></button>
    </>
  );

  return (
    <>
      <PanelHeader subtitle={trip.title} onClose={onClose} actions={headerActions} />
      {view === "history" ? (
        <HistoryView
          canSave={canSave}
          currentId={session.id}
          error={historyError}
          history={history}
          onBack={() => setView("chat")}
          onDelete={deleteSaved}
          onNew={startNew}
          onOpen={openSaved}
        />
      ) : (
        <ChatSession
          {...props}
          key={session.id}
          lastSaved={history?.saving ? history.conversations.find((item) => item.id !== session.id) : undefined}
          onOpenSaved={openSaved}
          onSettled={(messages) => {
            writeStoredSession(trip.id, { id: session.id, messages });
            if (history?.saving) void refreshHistory();
          }}
          saving={Boolean(history?.saving)}
          session={session}
        />
      )}
    </>
  );
}

function HistoryView({
  canSave,
  currentId,
  error,
  history,
  onBack,
  onDelete,
  onNew,
  onOpen,
}: {
  canSave: boolean;
  currentId: string;
  error: string;
  history: { saving: boolean; conversations: ConversationSummary[] } | null;
  onBack: () => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="assistant-scroll">
      <div className="assistant-history-head">
        <button className="assistant-back" onClick={onBack} type="button"><ArrowLeft size={15} /> Back to chat</button>
        <button className="assistant-back" onClick={onNew} type="button"><Plus size={15} /> New chat</button>
      </div>
      <h2 className="assistant-history-title">Saved chats</h2>
      {!canSave ? (
        <p className="assistant-history-note">Chats on the demo trip aren&rsquo;t saved. Create your own trip to keep them.</p>
      ) : history && !history.saving ? (
        <div className="assistant-history-note">
          <p>Saving is off, so chats only last until you close this tab.</p>
          <Link className="text-action" href="/account#assistant">Turn on saved chats</Link>
        </div>
      ) : null}
      {error ? <p className="assistant-history-note error">{error}</p> : null}
      {history === null ? (
        <p className="assistant-history-note">Loading…</p>
      ) : history.conversations.length ? (
        <ul className="assistant-history">
          {history.conversations.map((item) => (
            <li className={item.id === currentId ? "current" : undefined} key={item.id}>
              <button className="assistant-history-open" onClick={() => onOpen(item.id)} type="button">
                <MessageSquare size={15} aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{formatWhen(item.updatedAt)} · {item.messageCount} messages{item.id === currentId ? " · open now" : ""}</small>
                </span>
              </button>
              <button className="assistant-icon-button" onClick={() => onDelete(item.id)} aria-label={`Delete “${item.title}”`} title="Delete chat" type="button"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      ) : history.saving ? (
        <p className="assistant-history-note">No saved chats for this trip yet. They&rsquo;ll show up here after your first reply.</p>
      ) : null}
    </div>
  );
}

function ChatSession({
  open,
  trip,
  viewerName,
  savedPlaceIds,
  onAddPlace,
  session,
  saving,
  lastSaved,
  onOpenSaved,
  onSettled,
}: Props & {
  session: Session;
  saving: boolean;
  lastSaved?: ConversationSummary;
  onOpenSaved: (id: string) => void;
  onSettled: (messages: AssistantMessage[]) => void;
}) {
  const transport = useMemo(() => new DefaultChatTransport<AssistantMessage>({ api: "/api/assistant", body: { tripId: trip.id } }), [trip.id]);
  const { messages, sendMessage, status, error, stop, setMessages, regenerate, clearError } = useChat<AssistantMessage>({
    id: session.id,
    messages: session.messages,
    transport,
  });
  const [input, setInput] = useState("");
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settle = useEffectEvent((settled: AssistantMessage[]) => onSettled(settled));
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (status === "ready" || status === "error") settle(messages);
  }, [messages, status]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!open) return;
    // Wait for the slide-in so focusing doesn't jump the page on phones.
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 260);
    return () => window.clearTimeout(timer);
  }, [open]);

  function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    if (error) clearError();
    // A question that never got an answer (an error, or a stop) is replaced, not repeated.
    const last = messages.at(-1);
    if (last?.role === "user") setMessages(messages.slice(0, -1));
    void sendMessage({ text: value });
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "";
  }

  function retry() {
    clearError();
    void regenerate();
  }

  function add(pick: AssistantPick) {
    onAddPlace(pick);
    setAdded((current) => new Set(current).add(pick.fsqPlaceId));
  }

  const last = messages.at(-1);
  const lastPart = last?.role === "assistant" ? last.parts.at(-1) : undefined;
  const textStreaming = lastPart?.type === "text" && lastPart.state === "streaming";
  // Keep a visible "still working" row for the whole reply, not just before the first token.
  const working = busy && !textStreaming;
  const answered = last?.role === "assistant" && last.parts.some((part) =>
    (part.type === "text" && part.text.trim()) || (part.type === "tool-suggest_places" && part.state === "output-available"));
  const stalled = status === "ready" && last?.role === "assistant" && !answered;
  const model = [...messages].reverse().find((message) => message.metadata?.model)?.metadata?.model;
  const firstName = viewerName?.split(" ")[0];

  return (
    <>
      <div className="assistant-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="assistant-welcome">
            <span className="assistant-empty-mark"><Sparkles size={22} /></span>
            <h2>{firstName ? `Hi ${firstName}.` : "Hi there."} Where should we start?</h2>
            <p>I can see everything on this board. Ask for ideas, gaps in your days, or places near where you&rsquo;re staying.</p>
            {lastSaved ? (
              <button className="assistant-resume" onClick={() => onOpenSaved(lastSaved.id)} type="button">
                <History size={15} aria-hidden="true" />
                <span><small>Pick up where you left off</small><strong>{lastSaved.title}</strong></span>
              </button>
            ) : null}
            <div className="assistant-starters">
              {starterPrompts(trip).map((prompt) => (
                <button key={prompt} onClick={() => send(prompt)} type="button">{prompt}</button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="assistant-messages">
            {messages.map((message) => (
              <li className={`assistant-message ${message.role}`} key={message.id}>
                {message.parts.map((part, index) => {
                  const key = `${message.id}-${index}`;
                  switch (part.type) {
                    case "text":
                      if (!part.text.trim()) return null;
                      return message.role === "user" ? (
                        <p className="assistant-bubble" key={key}>{part.text}</p>
                      ) : (
                        <div className="assistant-prose" key={key}>
                          <Markdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{part.text}</Markdown>
                        </div>
                      );
                    case "tool-search_places": {
                      const query = part.state === "output-available" ? part.output.query : part.input?.query;
                      const where = part.input?.near ? ` in ${part.input.near}` : "";
                      const label = `“${query ?? "places"}”${where}`;
                      if (part.state === "output-available") {
                        const count = part.output.results.length;
                        return <p className="assistant-step done" key={key} title={label}><Search size={13} /><span>Searched {label}</span><em>{count ? `${count} found` : "none"}</em></p>;
                      }
                      if (part.state === "output-error") return <p className="assistant-step" key={key}><Search size={13} /><span>Search didn&rsquo;t work</span></p>;
                      return <p className="assistant-step working" key={key} title={label}><Search size={13} /><span>Searching {label}…</span></p>;
                    }
                    case "tool-suggest_places":
                      if (part.state !== "output-available") {
                        return part.state === "output-error" ? null : <p className="assistant-step working" key={key}><Sparkles size={13} /><span>Picking the best spots…</span></p>;
                      }
                      return (
                        <ul className="assistant-picks" key={key}>
                          {part.output.places.map((pick) => (
                            <PickCard
                              key={pick.fsqPlaceId}
                              onAdd={() => add(pick)}
                              pick={pick}
                              state={added.has(pick.fsqPlaceId) ? "added" : savedPlaceIds.has(pick.fsqPlaceId) ? "saved" : "idle"}
                            />
                          ))}
                        </ul>
                      );
                    default:
                      return null;
                  }
                })}
              </li>
            ))}
            {working ? (
              <li className="assistant-message assistant">
                <p className="assistant-thinking" role="status">
                  <span className="assistant-dots" aria-hidden="true"><span /><span /><span /></span>
                  {status === "submitted" ? "Thinking" : "Working on it"}
                </p>
              </li>
            ) : null}
          </ol>
        )}
        {stalled && !error ? (
          <div className="assistant-notice" role="status">
            <p>The free model stopped before it finished answering.</p>
            <button className="button button-small" onClick={retry} type="button"><RotateCcw size={14} /> Try again</button>
          </div>
        ) : null}
        {error ? (
          <div className="assistant-error" role="alert">
            <p>{errorText(error)}</p>
            <button className="button button-small" onClick={retry} type="button"><RotateCcw size={14} /> Try again</button>
          </div>
        ) : null}
      </div>

      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <div className="assistant-input">
          <label className="sr-only" htmlFor="assistant-input">Message the trip assistant</label>
          <textarea
            id="assistant-input"
            ref={inputRef}
            enterKeyHint="send"
            onChange={(event) => {
              setInput(event.target.value);
              event.target.style.height = "";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder={`Ask about ${trip.destination.split(",")[0] || "your trip"}…`}
            rows={1}
            value={input}
          />
          {busy ? (
            <button className="assistant-send" onClick={() => void stop()} aria-label="Stop" title="Stop" type="button"><Square size={13} fill="currentColor" /></button>
          ) : (
            <button className="assistant-send" disabled={!input.trim()} aria-label="Send" type="submit"><ArrowUp size={18} /></button>
          )}
        </div>
        <p className="assistant-footnote">
          {saving ? "Saved to your account" : "Not saved"}{model ? ` · ${shortModelName(model)}` : ""} · AI can be wrong
        </p>
      </form>
    </>
  );
}

function PickCard({ pick, state, onAdd }: { pick: AssistantPick; state: "idle" | "added" | "saved"; onAdd: () => void }) {
  const Icon = categoryIcons[pick.category] ?? MapPin;
  const mapsUrl = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${pick.name} ${pick.address}` })}`;
  return (
    <li className="assistant-pick">
      <span className={`assistant-pick-icon ${categoryClass(pick.category)}`} aria-hidden="true"><Icon size={16} /></span>
      <div className="assistant-pick-body">
        <div className="assistant-pick-head">
          <strong>{pick.name}</strong>
          <a href={mapsUrl} target="_blank" rel="noreferrer" aria-label={`Open ${pick.name} in Google Maps`}><ExternalLink size={13} /></a>
        </div>
        <span className="assistant-pick-meta">
          {[pick.category, pick.neighborhood].filter(Boolean).join(" · ")}
        </span>
        {pick.reason ? <p>{pick.reason}</p> : null}
        <div className="assistant-pick-actions">
          {pick.plannedDate ? <span className="assistant-pick-day"><CalendarDays size={12} /> {formatDay(pick.plannedDate)}</span> : null}
          {state === "idle" ? (
            <button className="assistant-add" onClick={onAdd} type="button"><Plus size={14} /> {pick.plannedDate ? "Add to day" : "Add to trip"}</button>
          ) : (
            <span className="assistant-added"><Check size={14} /> {state === "added" ? "Added" : "In your trip"}</span>
          )}
        </div>
      </div>
    </li>
  );
}
