"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  BedDouble,
  CalendarDays,
  Check,
  Coffee,
  ExternalLink,
  Landmark,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Square,
  TramFront,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { shortModelName } from "@/lib/assistant/models";
import type { AssistantMessage, AssistantPick } from "@/lib/assistant/tools";
import { categoryClass, type PlaceCategory } from "@/lib/types";

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

function storageKey(tripId: string) {
  return `tripboard:assistant:${tripId}`;
}

function readStoredMessages(tripId: string): AssistantMessage[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(tripId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredMessages(tripId: string, messages: AssistantMessage[]) {
  try {
    if (messages.length) window.sessionStorage.setItem(storageKey(tripId), JSON.stringify(messages.slice(-40)));
    else window.sessionStorage.removeItem(storageKey(tripId));
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

function PanelHeader({ subtitle, onClose, onReset }: { subtitle: string; onClose: () => void; onReset?: () => void }) {
  return (
    <header className="assistant-header">
      <span className="assistant-grabber" aria-hidden="true" />
      <span className="assistant-mark" aria-hidden="true"><Sparkles size={16} /></span>
      <div className="assistant-title">
        <strong>Trip assistant</strong>
        <span>{subtitle}</span>
      </div>
      {onReset ? (
        <button className="assistant-icon-button" onClick={onReset} aria-label="Start a new chat" title="New chat" type="button"><RotateCcw size={16} /></button>
      ) : null}
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

function AssistantChat({ open, onClose, trip, viewerName, savedPlaceIds, onAddPlace }: Props) {
  const [initialMessages] = useState(() => readStoredMessages(trip.id));
  const transport = useMemo(() => new DefaultChatTransport<AssistantMessage>({ api: "/api/assistant", body: { tripId: trip.id } }), [trip.id]);
  const { messages, sendMessage, status, error, stop, setMessages, regenerate, clearError } = useChat<AssistantMessage>({
    id: `trip-assistant-${trip.id}`,
    messages: initialMessages,
    transport,
  });
  const [input, setInput] = useState("");
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (status === "ready" || status === "error") writeStoredMessages(trip.id, messages);
  }, [messages, status, trip.id]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!open) return;
    // Wait for the slide-in so focusing doesn't jump the page on phones.
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 260);
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    if (error) clearError();
    void sendMessage({ text: value });
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "";
  }

  function reset() {
    void stop();
    setMessages([]);
    setAdded(new Set());
    writeStoredMessages(trip.id, []);
    inputRef.current?.focus();
  }

  function add(pick: AssistantPick) {
    onAddPlace(pick);
    setAdded((current) => new Set(current).add(pick.fsqPlaceId));
  }

  const last = messages.at(-1);
  const lastHasContent = last?.role === "assistant" && last.parts.some((part) => (part.type === "text" && part.text.trim()) || part.type.startsWith("tool-"));
  const thinking = status === "submitted" || (status === "streaming" && !lastHasContent);
  const model = [...messages].reverse().find((message) => message.metadata?.model)?.metadata?.model;
  const firstName = viewerName?.split(" ")[0];

  return (
    <>
      <PanelHeader subtitle={trip.title} onClose={onClose} onReset={messages.length ? reset : undefined} />

      <div className="assistant-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="assistant-welcome">
            <span className="assistant-empty-mark"><Sparkles size={22} /></span>
            <h2>{firstName ? `Hi ${firstName}.` : "Hi there."} Where should we start?</h2>
            <p>I can see everything on this board. Ask for ideas, gaps in your days, or places near where you&rsquo;re staying.</p>
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
                      const where = part.input?.near ? ` in ${part.input.near}` : "";
                      if (part.state === "output-available") {
                        const count = part.output.results.length;
                        return <p className="assistant-step done" key={key}><Search size={13} /> Searched &ldquo;{part.output.query}&rdquo;{where} · {count ? `${count} found` : "nothing found"}</p>;
                      }
                      if (part.state === "output-error") return <p className="assistant-step" key={key}><Search size={13} /> Search didn&rsquo;t work</p>;
                      return <p className="assistant-step working" key={key}><Search size={13} /> Searching{part.input?.query ? ` “${part.input.query}”` : ""}{where}…</p>;
                    }
                    case "tool-suggest_places":
                      if (part.state !== "output-available") {
                        return part.state === "output-error" ? null : <p className="assistant-step working" key={key}><Sparkles size={13} /> Picking the best spots…</p>;
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
            {thinking ? (
              <li className="assistant-message assistant">
                <p className="assistant-thinking" role="status"><span /><span /><span /><span className="sr-only">Thinking</span></p>
              </li>
            ) : null}
          </ol>
        )}
        {error ? (
          <div className="assistant-error" role="alert">
            <p>{errorText(error)}</p>
            <button className="button button-small" onClick={() => { clearError(); void regenerate(); }} type="button"><RotateCcw size={14} /> Try again</button>
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
            <button className="assistant-send" onClick={() => void stop()} aria-label="Stop" type="button"><Square size={13} fill="currentColor" /></button>
          ) : (
            <button className="assistant-send" disabled={!input.trim()} aria-label="Send" type="submit"><ArrowUp size={18} /></button>
          )}
        </div>
        <p className="assistant-footnote">Free AI{model ? ` · ${shortModelName(model)}` : ""} · can be wrong, so double-check</p>
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
