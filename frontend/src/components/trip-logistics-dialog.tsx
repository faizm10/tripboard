"use client";

import { CalendarDays, MapPin, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteTrip, updateTrip } from "@/app/trips/actions";
import { CityField } from "@/components/city-field";
import { CountryFlag } from "@/components/country-flag";
import { flagCodeForTrip } from "@/lib/country-flag";
import { countryFromDestination, formatDateLabel } from "@/lib/dates";
import type { Trip } from "@/lib/types";
import { createTripSchema } from "@/lib/validators";

export type TripDetails = Pick<Trip, "title" | "destination" | "country" | "dateLabel" | "startDate" | "endDate">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TripLogisticsDialog({
  trip,
  canDelete = false,
  onClose,
  onSave,
}: {
  trip: TripDetails & { id: string };
  /** Owners only — the server enforces this too, this just hides a button that would fail. */
  canDelete?: boolean;
  onClose: () => void;
  onSave: (details: TripDetails) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Tracks the destination as it is picked so the flag keeps up with the form.
  const [destination, setDestination] = useState(trip.destination);

  const persistable = UUID.test(trip.id);
  /*
   * While the destination is the saved one, the trip's own country is
   * authoritative — `countryFromDestination` echoes the input back when there is
   * no comma ("New York" -> "New York"), so deriving from the label alone would
   * never resolve a flag. Once a new city is picked its label carries the
   * country ("Paris, France").
   */
  const flagCode = flagCodeForTrip(
    destination === trip.destination
      ? { country: trip.country, destination }
      : { country: countryFromDestination(destination), destination },
  );

  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!String(data.destination ?? "").trim()) {
      setError("Pick a city or country from the list so the trip can be saved.");
      return;
    }
    const parsed = createTripSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your trip details.");
      return;
    }
    const next: TripDetails = {
      title: parsed.data.title,
      destination: parsed.data.destination,
      country: countryFromDestination(parsed.data.destination),
      startDate: parsed.data.startDate || "",
      endDate: parsed.data.endDate || "",
      dateLabel: formatDateLabel(parsed.data.startDate, parsed.data.endDate),
    };
    if (!persistable) {
      onSave(next);
      onClose();
      return;
    }
    setPending(true);
    setError("");
    try {
      await updateTrip({ ...parsed.data, tripId: trip.id });
      onSave(next);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The trip could not be updated.");
      setPending(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteTrip({ tripId: trip.id });
      router.push("/trips");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The trip could not be deleted.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="place-dialog logistics-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logistics-title"
        tabIndex={-1}
      >
        <div className="logistics-visual">
          {flagCode ? (
            <CountryFlag
              className="logistics-visual-flag"
              code={flagCode}
              country={destination}
              sizes="(max-width: 760px) 100vw, 232px"
            />
          ) : (
            <span className="logistics-visual-fallback" aria-hidden="true">
              <MapPin size={30} />
            </span>
          )}
          <p className="logistics-visual-caption">{destination || "Somewhere new"}</p>
        </div>

        <div className="logistics-main">
          <header>
            <span className="dialog-step">Trip details</span>
            <button className="icon-button" onClick={onClose} aria-label="Close" type="button">
              <X size={20} />
            </button>
          </header>
          <p className="eyebrow">Change the plan</p>
          <h2 id="logistics-title">Where, when, what</h2>
          <form className="new-trip-form" onSubmit={submit}>
            <label>
              <span>What are you calling it?</span>
              <input defaultValue={trip.title} name="title" placeholder="New York, loosely" required />
            </label>
            <CityField defaultValue={trip.destination} onCityChange={setDestination} />
            <div className="date-fields">
              <label>
                <span>
                  <CalendarDays size={15} /> Start
                </span>
                <input defaultValue={trip.startDate} name="startDate" type="date" />
              </label>
              <label>
                <span>Come home</span>
                <input defaultValue={trip.endDate} name="endDate" type="date" />
              </label>
            </div>
            <p className="date-optional">Optional. Leave blank if the dates are still open.</p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button button-ink button-full" disabled={pending || deleting} type="submit">
              {pending ? "Saving…" : "Save changes"}
            </button>
          </form>

          {canDelete && persistable ? (
            <div className="logistics-danger">
              {confirmingDelete ? (
                <>
                  <p className="logistics-danger-copy">
                    Delete <strong>{trip.title}</strong>? This removes the board, its places and its
                    notes for everyone on it. It cannot be undone.
                  </p>
                  <div className="logistics-danger-actions">
                    <button
                      className="button button-small"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                      type="button"
                    >
                      Keep it
                    </button>
                    <button
                      className="button button-small button-danger"
                      disabled={deleting}
                      onClick={confirmDelete}
                      type="button"
                    >
                      {deleting ? "Deleting…" : "Yes, delete it"}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="text-action logistics-danger-trigger"
                  onClick={() => setConfirmingDelete(true)}
                  type="button"
                >
                  <Trash2 size={14} /> Delete this trip
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
