"use client";

import { Bus, Plane, TrainFront, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Flight, JourneyMode } from "@/lib/types";

export type FlightDraft = Omit<Flight, "id">;

const journeyCopy = {
  flight: {
    label: "Flight",
    add: "Add a flight",
    edit: "Edit flight",
    operator: "Airline",
    number: "Flight no.",
    operatorPlaceholder: "Air Canada",
    numberPlaceholder: "AC 836",
    fromPlaceholder: "YYZ",
    toPlaceholder: "LIS",
    remove: "Remove flight",
    save: "Save flight",
    create: "Add flight",
  },
  train: {
    label: "Train",
    add: "Add a train",
    edit: "Edit train",
    operator: "Operator",
    number: "Train no.",
    operatorPlaceholder: "Amtrak",
    numberPlaceholder: "Acela 2153",
    fromPlaceholder: "Union Station",
    toPlaceholder: "Penn Station",
    remove: "Remove train",
    save: "Save train",
    create: "Add train",
  },
  bus: {
    label: "Bus",
    add: "Add a bus",
    edit: "Edit bus",
    operator: "Operator",
    number: "Bus no.",
    operatorPlaceholder: "FlixBus",
    numberPlaceholder: "FB 123",
    fromPlaceholder: "Port Authority",
    toPlaceholder: "South Station",
    remove: "Remove bus",
    save: "Save bus",
    create: "Add bus",
  },
} as const;

export function journeyModeOf(flight: Flight): JourneyMode {
  return flight.mode === "train" || flight.mode === "bus" ? flight.mode : "flight";
}

export function JourneyIcon({ mode, size = 16 }: { mode: JourneyMode; size?: number }) {
  if (mode === "train") return <TrainFront size={size} />;
  if (mode === "bus") return <Bus size={size} />;
  return <Plane size={size} />;
}

export function FlightPlanDialog({
  flight,
  initialDate,
  mode = "flight",
  onClose,
  onDelete,
  onSave,
}: {
  flight?: Flight | null;
  initialDate: string;
  mode?: JourneyMode;
  onClose: () => void;
  onDelete?: (flightId: string) => void;
  onSave: (flight: FlightDraft) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const journeyMode = flight ? journeyModeOf(flight) : mode;
  const copy = journeyCopy[journeyMode];

  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const departureAirport = String(form.get("departureAirport") ?? "").trim();
    const arrivalAirport = String(form.get("arrivalAirport") ?? "").trim();
    if (journeyMode === "flight") {
      if (!/^[A-Za-z]{3}$/.test(departureAirport) || !/^[A-Za-z]{3}$/.test(arrivalAirport)) {
        setError("Use three-letter airport codes, such as YYZ or LIS.");
        return;
      }
    } else if (departureAirport.length < 2 || arrivalAirport.length < 2) {
      setError(journeyMode === "train" ? "Name both stations." : "Name both stops.");
      return;
    }
    onSave({
      mode: journeyMode,
      plannedDate: String(form.get("plannedDate") ?? ""),
      arrivalDate: String(form.get("arrivalDate") ?? ""),
      airline: String(form.get("airline") ?? "").trim(),
      flightNumber: String(form.get("flightNumber") ?? "").trim(),
      departureAirport: journeyMode === "flight" ? departureAirport.toUpperCase() : departureAirport,
      arrivalAirport: journeyMode === "flight" ? arrivalAirport.toUpperCase() : arrivalAirport,
      departureTime: String(form.get("departureTime") ?? ""),
      arrivalTime: String(form.get("arrivalTime") ?? ""),
    });
    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="place-dialog flight-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="flight-plan-title" tabIndex={-1}>
        <header>
          <span className="dialog-step">{copy.label}</span>
          <button className="icon-button" onClick={onClose} aria-label="Close" type="button"><X size={20} /></button>
        </header>
        <p className="eyebrow"><JourneyIcon mode={journeyMode} size={13} /> Travel day</p>
        <h2 id="flight-plan-title">{flight ? copy.edit : copy.add}</h2>
        <form className="flight-form" onSubmit={submit}>
          <div className="flight-form-grid">
            <label className="field-label"><span>Departs date</span><input defaultValue={flight?.plannedDate ?? initialDate} name="plannedDate" required type="date" /></label>
            <label className="field-label"><span>Arrives date</span><input defaultValue={flight?.arrivalDate ?? initialDate} name="arrivalDate" required type="date" /></label>
          </div>
          <div className="flight-form-grid">
            <label className="field-label"><span>{copy.operator} <small>Optional</small></span><input defaultValue={flight?.airline ?? ""} name="airline" placeholder={copy.operatorPlaceholder} /></label>
            <label className="field-label"><span>{copy.number} <small>Optional</small></span><input defaultValue={flight?.flightNumber ?? ""} name="flightNumber" placeholder={copy.numberPlaceholder} /></label>
          </div>
          <div className={`flight-form-grid${journeyMode === "flight" ? " flight-route-fields" : ""}`}>
            <label className="field-label"><span>From</span><input defaultValue={flight?.departureAirport ?? ""} maxLength={journeyMode === "flight" ? 3 : 80} name="departureAirport" placeholder={copy.fromPlaceholder} required /></label>
            <label className="field-label"><span>To</span><input defaultValue={flight?.arrivalAirport ?? ""} maxLength={journeyMode === "flight" ? 3 : 80} name="arrivalAirport" placeholder={copy.toPlaceholder} required /></label>
          </div>
          <div className="flight-form-grid">
            <label className="field-label"><span>Departs</span><input defaultValue={flight?.departureTime ?? ""} name="departureTime" required type="time" /></label>
            <label className="field-label"><span>Arrives</span><input defaultValue={flight?.arrivalTime ?? ""} name="arrivalTime" required type="time" /></label>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="flight-dialog-actions">
            {flight && onDelete ? <button className="button button-ghost" onClick={() => { onDelete(flight.id); onClose(); }} type="button">{copy.remove}</button> : <span />}
            <button className="button button-ink" type="submit">{flight ? copy.save : copy.create}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
