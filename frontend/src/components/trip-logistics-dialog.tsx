"use client";

import { CalendarDays, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateTrip } from "@/app/trips/actions";
import { CityField } from "@/components/city-field";
import { countryFromDestination, formatDateLabel } from "@/lib/dates";
import type { Trip } from "@/lib/types";
import { createTripSchema } from "@/lib/validators";

export type TripDetails = Pick<Trip, "title" | "destination" | "country" | "dateLabel" | "startDate" | "endDate">;

export function TripLogisticsDialog({
  trip,
  onClose,
  onSave,
}: {
  trip: TripDetails & { id: string };
  onClose: () => void;
  onSave: (details: TripDetails) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
    const persistable = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trip.id);
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
          <CityField defaultValue={trip.destination} />
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
          <button className="button button-ink button-full" disabled={pending} type="submit">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
    </div>
  );
}
