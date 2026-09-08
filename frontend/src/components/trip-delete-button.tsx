"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteTrip } from "@/app/trips/actions";

/**
 * Sits beside the trip card rather than inside it: the card itself is one big
 * link, and a button nested in an anchor is invalid and unreliable to click.
 */
export function TripDeleteButton({ tripId, title }: { tripId: string; title: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, deleting]);

  async function confirm() {
    setDeleting(true);
    setError("");
    try {
      await deleteTrip({ tripId });
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The trip could not be deleted.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        aria-label={`Delete ${title}`}
        className="trip-delete"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Trash2 size={15} />
      </button>

      {open ? (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && !deleting && setOpen(false)}
        >
          <section
            className="place-dialog confirm-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-${tripId}`}
            tabIndex={-1}
          >
            <header>
              <span className="dialog-step">Delete trip</span>
              <button
                className="icon-button"
                disabled={deleting}
                onClick={() => setOpen(false)}
                aria-label="Close"
                type="button"
              >
                <X size={20} />
              </button>
            </header>
            <h2 id={`delete-${tripId}`}>Delete {title}?</h2>
            <p className="confirm-copy">
              This removes the board, its places and its notes for everyone on it. It cannot be
              undone.
            </p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="confirm-actions">
              <button className="button" disabled={deleting} onClick={() => setOpen(false)} type="button">
                Keep it
              </button>
              <button className="button button-danger" disabled={deleting} onClick={confirm} type="button">
                {deleting ? "Deleting…" : "Yes, delete it"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
