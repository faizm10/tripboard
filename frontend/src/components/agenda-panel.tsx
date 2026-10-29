"use client";

import { useEffect, useRef, useState } from "react";
import { updateAgendaBrief } from "@/app/trips/actions";
import { unwrap } from "@/lib/action-result";
import type { TripAgenda } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export function AgendaPanel({
  agenda,
  persistable,
  tripId,
  onSaveState,
}: {
  agenda: TripAgenda;
  persistable: boolean;
  tripId: string;
  onSaveState: (state: SaveState) => void;
}) {
  const [document, setDocument] = useState(agenda.brief);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  async function save(value: string) {
    if (!persistable) return;
    onSaveState("saving");
    try {
      await unwrap(updateAgendaBrief({ tripId, brief: value }));
      onSaveState("saved");
    } catch {
      onSaveState("error");
    }
  }

  function changeDocument(value: string) {
    setDocument(value);
    if (!persistable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(value), 650);
  }

  function saveImmediately() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void save(document);
  }

  return (
    <section className="agenda-document" aria-label="Shared trip document">
      <header className="agenda-document-meta">
        <span>Shared with every trip planner</span>
        <span>·</span>
        <span>Saves automatically</span>
      </header>
      <textarea
        aria-label="Trip agenda document"
        maxLength={5000}
        onBlur={saveImmediately}
        onChange={(event) => changeDocument(event.target.value)}
        placeholder="Start writing…"
        value={document}
      />
    </section>
  );
}
