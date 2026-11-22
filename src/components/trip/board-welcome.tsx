"use client";

import { Check, MapPin, Share2, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

type Progress = { open: boolean; asked: boolean };

function storageKey(tripId: string) {
  return `tb-board-welcome-${tripId}`;
}

function readProgress(tripId: string): Progress | null {
  try {
    const saved = window.localStorage.getItem(storageKey(tripId));
    return saved ? (JSON.parse(saved) as Progress) : null;
  } catch {
    return null;
  }
}

function saveProgress(tripId: string, progress: Progress) {
  try {
    window.localStorage.setItem(storageKey(tripId), JSON.stringify(progress));
  } catch {}
}

/**
 * Getting-started list on a board that was just made in the welcome flow
 * (`?welcome=1`). Steps tick themselves off as the trip fills in, and it stays
 * until it is closed, even across reloads.
 */
export function BoardWelcome({
  tripId,
  places,
  people,
  onAddPlace,
  onInvite,
  onAsk,
}: {
  tripId: string;
  places: number;
  people: number;
  onAddPlace: () => void;
  onInvite: () => void;
  onAsk: () => void;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    let next = readProgress(tripId);
    if (url.searchParams.has("welcome")) {
      next = next ?? { open: true, asked: false };
      saveProgress(tripId, next);
      url.searchParams.delete("welcome");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    // Reading browser-only state after mount keeps the server render identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(next);
  }, [tripId]);

  if (!progress?.open) return null;

  function update(change: Partial<Progress>) {
    const next = { ...progress!, ...change };
    saveProgress(tripId, next);
    setProgress(next);
  }

  const steps = [
    { done: places > 0, icon: MapPin, label: "Save your first place", hint: "Search a spot or paste a link", action: onAddPlace },
    { done: people > 1, icon: Share2, label: "Invite your group", hint: "Email or share a link", action: onInvite },
    {
      done: progress.asked,
      icon: Sparkles,
      label: "Ask the assistant for ideas",
      hint: "Real picks, dropped on the map",
      action: () => {
        update({ asked: true });
        onAsk();
      },
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section className="board-welcome" aria-label="Getting started">
      <header>
        <div>
          <p className="eyebrow">Your board is ready</p>
          <h2>{doneCount === steps.length ? "All set. Happy planning." : "Three things to do first"}</h2>
        </div>
        <span className="board-welcome-count">{doneCount}/{steps.length}</span>
        <button aria-label="Close getting started" className="icon-button" onClick={() => update({ open: false })} type="button">
          <X size={16} />
        </button>
      </header>
      <div className="board-welcome-bar" aria-hidden="true">
        <i style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol>
        {steps.map(({ done, icon: Icon, label, hint, action }) => (
          <li key={label}>
            <button className={done ? "done" : undefined} onClick={action} type="button">
              <span>{done ? <Check aria-hidden="true" size={15} /> : <Icon aria-hidden="true" size={15} />}</span>
              <strong>{label}</strong>
              <small>{done ? "Done" : hint}</small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
