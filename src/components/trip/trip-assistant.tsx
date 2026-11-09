"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowLeft,
  ArrowUp,
  BedDouble,
  CalendarDays,
  Check,
  FileText,
  Receipt,
  Coffee,
  ExternalLink,
  History,
  Landmark,
  Map as MapIcon,
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
import { loadConnectedProviders, loadConversation, loadTripConversations, removeConversation } from "@/lib/assistant/actions";
import { shortModelName } from "@/lib/assistant/models";
import { choiceValue, parseChoice, PROVIDER_INFO, type AssistantChoice, type OwnKeyProvider } from "@/lib/assistant/providers";
import type { ConversationSummary } from "@/lib/assistant/store";
import { collectSuggestions, hotelDistanceLabel, type MapSuggestion } from "@/lib/assistant/suggestions";
import type { AssistantMessage, AssistantPick, ProposedChanges } from "@/lib/assistant/tools";

export type ApplyResult = { applied: number; failed: string[] };
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
  /** Reports every place this chat has suggested, so the trip map can pin them. */
  onSuggestionsChange?: (suggestions: MapSuggestion[]) => void;
  onShowOnMap?: (suggestion: MapSuggestion) => void;
  focusedSuggestionId?: string | null;
  /** Writes a reviewed draft into the trip. Absent when the viewer can't edit. */
  onApplyChanges?: (changes: ProposedChanges) => Promise<ApplyResult>;
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

const CHOICE_STORAGE_KEY = "tripboard:assistant:provider";

function readStoredChoice() {
  try {
    return window.localStorage.getItem(CHOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredChoice(value: string) {
  try {
    window.localStorage.setItem(CHOICE_STORAGE_KEY, value);
  } catch {
    // Private windows can refuse storage; the choice still holds for this visit.
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
  const [connected, setConnected] = useState<OwnKeyProvider[] | null>(null);
  const [storedChoice, setStoredChoice] = useState(readStoredChoice);
  const choice = parseChoice(storedChoice, connected);

  // Reloaded on each open so a key added in another tab shows up.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadConnectedProviders()
      .then((providers) => !cancelled && setConnected(providers))
      .catch(() => !cancelled && setConnected(null));
    return () => {
      cancelled = true;
    };
  }, [open]);

  function changeChoice(value: string) {
    setStoredChoice(value);
    writeStoredChoice(value);
  }

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
          connected={connected}
          key={session.id}
          lastSaved={history?.saving ? history.conversations.find((item) => item.id !== session.id) : undefined}
          onOpenSaved={openSaved}
          onChoiceChange={changeChoice}
          onSettled={(messages) => {
            writeStoredSession(trip.id, { id: session.id, messages });
            if (history?.saving) void refreshHistory();
          }}
          choice={choice}
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
  onSuggestionsChange,
  onShowOnMap,
  focusedSuggestionId,
  onApplyChanges,
  session,
  saving,
  lastSaved,
  onOpenSaved,
  onSettled,
  connected,
  choice,
  onChoiceChange,
}: Props & {
  session: Session;
  saving: boolean;
  lastSaved?: ConversationSummary;
  onOpenSaved: (id: string) => void;
  connected: OwnKeyProvider[] | null;
  choice: AssistantChoice;
  onChoiceChange: (value: string) => void;
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
  const suggestions = useMemo(() => collectSuggestions(messages), [messages]);
  const suggestionKey = suggestions.map((item) => item.fsqPlaceId).join("|");
  const labels = useMemo(() => new Map(suggestions.map((item) => [item.fsqPlaceId, item])), [suggestions]);
  const reportSuggestions = useEffectEvent(() => onSuggestionsChange?.(suggestions));

  useEffect(() => {
    reportSuggestions();
  }, [suggestionKey]);

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
    void sendMessage({ text: value }, { body: choice });
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "";
  }

  function retry() {
    clearError();
    void regenerate({ body: choice });
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
    (part.type === "text" && part.text.trim()) || ((part.type === "tool-suggest_places" || part.type === "tool-propose_changes") && part.state === "output-available"));
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
            <p>I can see everything on this board. Ask for ideas, or paste an itinerary, booking emails or costs and I&rsquo;ll draft them into your day plan, agenda and money for you to apply.</p>
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
                    case "tool-propose_changes":
                      if (part.state !== "output-available") {
                        return part.state === "output-error" ? null : <p className="assistant-step working" key={key}><SquarePen size={13} /><span>Drafting changes to your trip…</span></p>;
                      }
                      return (
                        <ChangesCard
                          changes={part.output}
                          key={key}
                          labels={labels}
                          onApply={onApplyChanges}
                          onShowOnMap={onShowOnMap}
                        />
                      );
                    case "tool-suggest_places":
                      if (part.state !== "output-available") {
                        return part.state === "output-error" ? null : <p className="assistant-step working" key={key}><Sparkles size={13} /><span>Picking the best spots…</span></p>;
                      }
                      return (
                        <ul className="assistant-picks" key={key}>
                          {part.output.places.map((pick) => (
                            <PickCard
                              focused={focusedSuggestionId === pick.fsqPlaceId}
                              key={pick.fsqPlaceId}
                              label={labels.get(pick.fsqPlaceId)?.label}
                              onAdd={() => add(pick)}
                              onShowOnMap={onShowOnMap && labels.has(pick.fsqPlaceId) ? () => onShowOnMap(labels.get(pick.fsqPlaceId)!) : undefined}
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
            <p>The model stopped before it finished answering.</p>
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
        {connected ? (
          <div className="assistant-provider">
            {connected.length ? (
              <>
                <label htmlFor="assistant-provider">Answer with</label>
                <select disabled={busy} id="assistant-provider" onChange={(event) => onChoiceChange(event.target.value)} value={choiceValue(choice)}>
                  <option value="free">Free models</option>
                  {connected.map((item) => (
                    <optgroup key={item} label={PROVIDER_INFO[item].name}>
                      {PROVIDER_INFO[item].models.map((model) => (
                        <option key={model.id} value={choiceValue({ provider: item, model: model.id })}>{model.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Link href="/account#ai-keys">Manage keys</Link>
              </>
            ) : (
              <Link href="/account#ai-keys">Use your own ChatGPT, Claude or Gemini key</Link>
            )}
          </div>
        ) : null}
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
            placeholder={`Ask about ${trip.destination.split(",")[0] || "your trip"}, or paste an itinerary…`}
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

function PickCard({
  pick,
  label,
  focused,
  state,
  onAdd,
  onShowOnMap,
}: {
  pick: AssistantPick;
  label?: string;
  focused: boolean;
  state: "idle" | "added" | "saved";
  onAdd: () => void;
  onShowOnMap?: () => void;
}) {
  const Icon = categoryIcons[pick.category] ?? MapPin;
  const mapsUrl = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${pick.name} ${pick.address}` })}`;
  const fromHotel = hotelDistanceLabel(pick.fromHotel);
  return (
    <li className={`assistant-pick${focused ? " focused" : ""}`}>
      <span className={`assistant-pick-icon ${categoryClass(pick.category)}`} aria-hidden="true">
        <Icon size={16} />
        {label ? <b className="assistant-pick-label">{label}</b> : null}
      </span>
      <div className="assistant-pick-body">
        <div className="assistant-pick-head">
          <strong>{pick.name}</strong>
          <a href={mapsUrl} target="_blank" rel="noreferrer" aria-label={`Open ${pick.name} in Google Maps`}><ExternalLink size={13} /></a>
        </div>
        <span className="assistant-pick-meta">
          {[pick.category, pick.neighborhood].filter(Boolean).join(" · ")}
        </span>
        {fromHotel ? <span className="assistant-pick-meta">{fromHotel}</span> : null}
        {pick.reason ? <p>{pick.reason}</p> : null}
        <div className="assistant-pick-actions">
          {pick.plannedDate ? <span className="assistant-pick-day"><CalendarDays size={12} /> {formatDay(pick.plannedDate)}</span> : null}
          {onShowOnMap ? <button className="assistant-map-button" onClick={onShowOnMap} type="button"><MapIcon size={13} /> Map{label ? ` · ${label}` : ""}</button> : null}
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

type ChangeKey = `place:${number}` | `note:${number}` | "agenda" | `expense:${number}`;

function formatAmount(cents: number, currency: string | null) {
  const amount = cents / 100;
  if (!currency) return amount.toLocaleString("en", { maximumFractionDigits: 2 });
  try {
    return amount.toLocaleString("en", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return `${amount} ${currency}`;
  }
}

/** A drafted set of trip edits the user ticks through and applies in one go. */
function ChangesCard({
  changes,
  labels,
  onApply,
  onShowOnMap,
}: {
  changes: ProposedChanges;
  labels: Map<string, MapSuggestion>;
  onApply?: (changes: ProposedChanges) => Promise<ApplyResult>;
  onShowOnMap?: (suggestion: MapSuggestion) => void;
}) {
  const allKeys = useMemo<ChangeKey[]>(() => [
    ...changes.places.map((place, index) => (place.alreadyInTrip ? null : `place:${index}` as const)).filter((key): key is `place:${number}` => key !== null),
    ...changes.dayNotes.map((_, index) => `note:${index}` as const),
    ...(changes.agenda ? ["agenda" as const] : []),
    ...changes.expenses.map((_, index) => `expense:${index}` as const),
  ], [changes]);
  const [selected, setSelected] = useState<Set<ChangeKey>>(() => new Set(allKeys));
  const [status, setStatus] = useState<{ state: "idle" | "applying" | "done" | "error"; message?: string }>({ state: "idle" });
  const locked = status.state === "applying" || status.state === "done";
  const count = selected.size;

  function toggle(key: ChangeKey) {
    if (locked) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function apply() {
    if (!onApply || !count) return;
    setStatus({ state: "applying" });
    const picked: ProposedChanges = {
      summary: changes.summary,
      places: changes.places.filter((_, index) => selected.has(`place:${index}`)),
      dayNotes: changes.dayNotes.filter((_, index) => selected.has(`note:${index}`)),
      agenda: selected.has("agenda") ? changes.agenda : "",
      expenses: changes.expenses.filter((_, index) => selected.has(`expense:${index}`)),
    };
    try {
      const result = await onApply(picked);
      setStatus(result.failed.length
        ? { state: result.applied ? "done" : "error", message: `${result.failed.length} didn’t save: ${result.failed.join(", ")}` }
        : { state: "done", message: `Applied ${result.applied} ${result.applied === 1 ? "change" : "changes"}` });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error && error.message ? error.message : "Couldn’t apply these changes. Try again." });
    }
  }

  const row = (key: ChangeKey, body: React.ReactNode, disabled = false) => (
    <li className={`assistant-change${selected.has(key) ? " on" : ""}${disabled ? " disabled" : ""}`} key={key}>
      <label>
        <input checked={!disabled && selected.has(key)} disabled={disabled || locked} onChange={() => toggle(key)} type="checkbox" />
        <span className="assistant-change-body">{body}</span>
      </label>
    </li>
  );

  return (
    <section className="assistant-changes" aria-label="Proposed changes">
      <header>
        <span className="assistant-changes-mark" aria-hidden="true"><SquarePen size={14} /></span>
        <div>
          <strong>Draft changes</strong>
          {changes.summary ? <small>{changes.summary}</small> : null}
        </div>
      </header>

      {changes.places.length ? (
        <div className="assistant-changes-group">
          <h3><CalendarDays size={13} /> Day plan</h3>
          <ul>
            {changes.places.map((place, index) => {
              const label = labels.get(place.fsqPlaceId);
              return row(`place:${index}`, (
                <>
                  <span className="assistant-change-line">
                    {label ? <b className="assistant-change-letter">{label.label}</b> : null}
                    <strong>{place.name}</strong>
                    <em>{place.plannedDate ? formatDay(place.plannedDate) : "No day yet"}</em>
                  </span>
                  {place.alreadyInTrip ? <small>Already on this day</small> : place.note ? <small>{place.note}</small> : <small>{[place.category, place.neighborhood].filter(Boolean).join(" · ")}</small>}
                  {label && onShowOnMap ? <button className="assistant-change-map" onClick={(event) => { event.preventDefault(); onShowOnMap(label); }} type="button"><MapIcon size={12} /> Map</button> : null}
                </>
              ), place.alreadyInTrip);
            })}
          </ul>
        </div>
      ) : null}

      {changes.dayNotes.length ? (
        <div className="assistant-changes-group">
          <h3><FileText size={13} /> Day notes</h3>
          <ul>
            {changes.dayNotes.map((item, index) => row(`note:${index}`, (
              <><span className="assistant-change-line"><strong>{item.note}</strong><em>{formatDay(item.day)}</em></span></>
            )))}
          </ul>
        </div>
      ) : null}

      {changes.agenda ? (
        <div className="assistant-changes-group">
          <h3><FileText size={13} /> Agenda</h3>
          <ul>
            {row("agenda", (
              <>
                <span className="assistant-change-line"><strong>Add to the shared agenda</strong></span>
                <pre className="assistant-change-preview">{changes.agenda}</pre>
              </>
            ))}
          </ul>
        </div>
      ) : null}

      {changes.expenses.length ? (
        <div className="assistant-changes-group">
          <h3><Receipt size={13} /> Money</h3>
          <ul>
            {changes.expenses.map((item, index) => row(`expense:${index}`, (
              <>
                <span className="assistant-change-line"><strong>{item.title}</strong><em>{formatAmount(item.amountCents, item.currency)}</em></span>
                <small>{[item.paidBy ? `Paid by ${item.paidBy}` : "Paid by you", item.day ? formatDay(item.day) : "", "split evenly"].filter(Boolean).join(" · ")}</small>
              </>
            )))}
          </ul>
        </div>
      ) : null}

      {changes.note && !allKeys.length ? <p className="assistant-changes-status error">The assistant couldn’t match those places. Ask it to try again.</p> : null}

      <footer>
        {status.message ? <p className={`assistant-changes-status${status.state === "error" ? " error" : ""}`} role="status">{status.state === "done" ? <Check size={13} /> : null}{status.message}</p> : null}
        {status.state === "done" ? null : onApply ? (
          <button className="assistant-add" disabled={!count || status.state === "applying"} onClick={() => void apply()} type="button">
            {status.state === "applying" ? "Applying…" : `Apply ${count} ${count === 1 ? "change" : "changes"}`}
          </button>
        ) : (
          <p className="assistant-changes-status">Only trip editors can apply changes.</p>
        )}
      </footer>
    </section>
  );
}
