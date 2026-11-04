"use client";

import { Check, CheckSquare, Eye, FileText, Heading2, Link2, List, Pencil, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { updateAgendaBrief } from "@/app/trips/actions";
import { unwrap } from "@/lib/action-result";
import { AGENDA_MAX_LENGTH, agendaTemplate, describeLink, taskProgress, toggleTaskAt, wordCount } from "@/lib/agenda";
import type { Flight, HotelStay, TripAgenda } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";
type Mode = "read" | "edit";

export function AgendaPanel({
  agenda,
  flights,
  hotels,
  persistable,
  title,
  tripId,
  onSaveState,
}: {
  agenda: TripAgenda;
  flights: Flight[];
  hotels: HotelStay[];
  persistable: boolean;
  title: string;
  tripId: string;
  onSaveState: (state: SaveState) => void;
}) {
  const [document, setDocument] = useState(agenda.brief);
  const [mode, setMode] = useState<Mode>(agenda.brief.trim() ? "read" : "edit");
  const [status, setStatus] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const empty = !document.trim();
  const progress = taskProgress(document);
  const words = wordCount(document);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    if (mode !== "edit") return;
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "";
    node.style.height = `${node.scrollHeight}px`;
  }, [document, mode]);

  function report(state: SaveState) {
    setStatus(state);
    onSaveState(state);
  }

  async function save(value: string) {
    if (!persistable) return;
    report("saving");
    try {
      await unwrap(updateAgendaBrief({ tripId, brief: value }));
      report("saved");
    } catch {
      report("error");
    }
  }

  function changeDocument(value: string, { immediate = false } = {}) {
    setDocument(value);
    if (!persistable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (immediate) void save(value);
    else saveTimer.current = setTimeout(() => void save(value), 650);
  }

  function saveImmediately() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void save(document);
  }

  function startEditing() {
    setMode("edit");
    requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  }

  function finishEditing() {
    saveImmediately();
    if (document.trim()) setMode("read");
  }

  /** Adds a markdown prefix to the start of every selected line, or wraps the selection as a link. */
  function format(kind: "heading" | "list" | "task" | "link") {
    const node = textareaRef.current;
    if (!node) return;
    const { selectionStart: start, selectionEnd: end, value } = node;
    let next: string;
    let cursor: number;
    if (kind === "link") {
      const label = value.slice(start, end) || "link";
      const inserted = `[${label}](https://)`;
      next = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
      cursor = start + inserted.length - 1;
    } else {
      const prefix = kind === "heading" ? "## " : kind === "list" ? "- " : "- [ ] ";
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block.split("\n").map((line) => (line.startsWith(prefix) ? line : `${prefix}${line.replace(/^(#{1,6} |[-*+] (\[[ xX]\] )?)/, "")}`)).join("\n");
      next = `${value.slice(0, lineStart)}${prefixed}${value.slice(end)}`;
      cursor = lineStart + prefixed.length;
    }
    changeDocument(next);
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(cursor, cursor);
    });
  }

  const components: Components = {
    a: ({ href = "", children }) => {
      const text = typeof children === "string" ? children : Array.isArray(children) && children.length === 1 && typeof children[0] === "string" ? children[0] : null;
      // Bare pasted URLs turn into a compact chip; links someone named keep their words.
      if (text && (text === href || text.replace(/^https?:\/\//, "") === href.replace(/^https?:\/\//, ""))) {
        const link = describeLink(href);
        return (
          <a className="agenda-link-chip" href={href} rel="noreferrer" target="_blank" title={href}>
            <Link2 size={13} aria-hidden="true" />
            <span>{link.title}</span>
            {link.host && link.host !== link.title ? <small>{link.host}</small> : null}
          </a>
        );
      }
      return <a href={href} rel="noreferrer" target="_blank">{children}</a>;
    },
    li: ({ node, children, className }) => {
      const offset = node?.position?.start.offset;
      if (!className?.includes("task-list-item") || offset === undefined) return <li className={className}>{children}</li>;
      return (
        <li
          className={className}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) return;
            if (!(event.target as HTMLElement).matches("input[type=checkbox]")) return;
            event.preventDefault();
            changeDocument(toggleTaskAt(document, offset), { immediate: true });
          }}
        >
          {children}
        </li>
      );
    },
    input: ({ type, checked }) => type === "checkbox" ? <input aria-label={checked ? "Mark not done" : "Mark done"} checked={Boolean(checked)} readOnly type="checkbox" /> : null,
  };

  return (
    <section className="agenda-document" aria-label="Shared trip document">
      <header className="agenda-toolbar">
        <div className="agenda-mode" role="tablist" aria-label="Document view">
          <button aria-selected={mode === "read"} className={mode === "read" ? "active" : ""} disabled={empty} onClick={finishEditing} role="tab" type="button"><Eye size={13} /> Read</button>
          <button aria-selected={mode === "edit"} className={mode === "edit" ? "active" : ""} onClick={startEditing} role="tab" type="button"><Pencil size={13} /> Edit</button>
        </div>
        {mode === "edit" ? (
          <div className="agenda-format" aria-label="Formatting">
            <button aria-label="Heading" onMouseDown={(event) => event.preventDefault()} onClick={() => format("heading")} title="Heading" type="button"><Heading2 size={15} /></button>
            <button aria-label="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => format("list")} title="List" type="button"><List size={15} /></button>
            <button aria-label="Checklist" onMouseDown={(event) => event.preventDefault()} onClick={() => format("task")} title="Checklist" type="button"><CheckSquare size={15} /></button>
            <button aria-label="Link" onMouseDown={(event) => event.preventDefault()} onClick={() => format("link")} title="Link" type="button"><Link2 size={15} /></button>
          </div>
        ) : null}
        <p className="agenda-meta">
          {progress.total ? <span className="agenda-progress"><Check size={12} /> {progress.done}/{progress.total} done</span> : null}
          {words ? <span>{words.toLocaleString()} {words === 1 ? "word" : "words"}</span> : null}
          <span className={status === "error" ? "error" : undefined}>
            {!persistable ? "Demo · not saved" : status === "saving" ? "Saving…" : status === "error" ? "Couldn’t save" : status === "saved" ? "Saved" : "Shared with every planner"}
          </span>
        </p>
      </header>

      {mode === "edit" ? (
        <>
          {empty ? (
            <div className="agenda-starter">
              <FileText size={18} aria-hidden="true" />
              <div>
                <strong>One page for the whole group</strong>
                <p>Bookings, links, packing lists, who&rsquo;s bringing what. Everyone on the trip sees the same page.</p>
              </div>
              <button className="button button-small" onClick={() => changeDocument(agendaTemplate({ title, flights, hotels }), { immediate: true })} type="button"><Sparkles size={14} /> Start from this trip</button>
            </div>
          ) : null}
          <textarea
            aria-label="Trip agenda document"
            className="agenda-editor"
            maxLength={AGENDA_MAX_LENGTH}
            onBlur={saveImmediately}
            onChange={(event) => changeDocument(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
                event.preventDefault();
                finishEditing();
              }
            }}
            placeholder={"Start writing…\n\n## Headings, - lists, - [ ] checklists and pasted links all work."}
            ref={textareaRef}
            value={document}
          />
          <p className="agenda-hint">
            Markdown works: <code>## Heading</code>, <code>- list</code>, <code>- [ ] to do</code>, <code>**bold**</code>. Pasted links turn into tidy chips.
            {document.trim() ? <> <button className="inline-action" onClick={finishEditing} type="button">Done</button> <kbd>Esc</kbd></> : null}
          </p>
        </>
      ) : (
        <article className="agenda-read" onDoubleClick={(event) => !(event.target as HTMLElement).closest("a, input") && startEditing()}>
          <Markdown components={components} remarkPlugins={[remarkGfm, remarkBreaks]}>{document}</Markdown>
        </article>
      )}
    </section>
  );
}
