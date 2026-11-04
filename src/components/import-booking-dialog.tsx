"use client";

import { BedDouble, ClipboardPaste, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { JourneyIcon, type FlightDraft } from "@/components/flight-plan-dialog";
import type { HotelStayDraft } from "@/components/hotel-stay-dialog";
import type { ImportedBookings, ImportedHotel, ImportedJourney } from "@/lib/booking-import";
import type { CityStop } from "@/lib/types";

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const hasTimes = (journey: ImportedJourney) => Boolean(journey.departureTime && journey.arrivalTime);

export function ImportBookingDialog({ cities, onAddHotel, onAddJourney, onClose, tripStart }: {
  cities: CityStop[];
  onAddHotel: (stay: HotelStayDraft) => void;
  onAddJourney: (journey: FlightDraft) => void;
  onClose: () => void;
  tripStart?: string;
}) {
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [found, setFound] = useState<ImportedBookings | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function read() {
    setError("");
    setReading(true);
    try {
      const response = await fetch("/api/bookings/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, tripStart }) });
      const body = await response.json() as ImportedBookings & { error?: string };
      if (!response.ok) throw new Error(body.error || "Couldn’t read that confirmation.");
      if (!body.journeys.length && !body.hotels.length) throw new Error("No flights, trains, buses, or hotels found. Paste the whole email, including dates.");
      setFound(body);
      setPicked(new Set([...body.journeys.map((_, index) => `j${index}`), ...body.hotels.map((_, index) => `h${index}`)]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t read that confirmation.");
    } finally {
      setReading(false);
    }
  }

  function updateJourney(index: number, patch: Partial<ImportedJourney>) {
    setFound((current) => current && { ...current, journeys: current.journeys.map((journey, at) => at === index ? { ...journey, ...patch } : journey) });
  }

  function toggle(key: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function cityFor(stay: ImportedHotel) {
    return cities.find((city) => city.startDate && city.endDate && city.startDate <= stay.startDate && city.endDate >= stay.startDate) ?? cities[0];
  }

  async function addPicked() {
    if (!found) return;
    const journeys = found.journeys.filter((journey, index) => picked.has(`j${index}`));
    const missingTimes = journeys.filter((journey) => !hasTimes(journey));
    if (missingTimes.length) { setError("Add departure and arrival times for the highlighted trips, or untick them."); return; }
    setAdding(true);
    setError("");
    journeys.forEach((journey) => onAddJourney(journey));
    const unplaced: string[] = [];
    for (const [index, stay] of found.hotels.entries()) {
      if (!picked.has(`h${index}`)) continue;
      const query = [stay.name, stay.address].filter(Boolean).join(", ");
      const response = await fetch(`/api/cities/geocode?q=${encodeURIComponent(query)}`).catch(() => null);
      const body = response?.ok ? await response.json() as { coordinates?: [number, number] | null } : null;
      if (!body?.coordinates) { unplaced.push(stay.name); continue; }
      onAddHotel({ cityId: cityFor(stay)?.id ?? null, name: stay.name, address: stay.address, coordinates: body.coordinates, startDate: stay.startDate, endDate: stay.endDate });
    }
    setAdding(false);
    if (unplaced.length) {
      setError(`Added the rest. Couldn’t find ${unplaced.join(" and ")} on the map, so add ${unplaced.length === 1 ? "it" : "them"} from “Add hotel stay”.`);
      setFound(null);
      return;
    }
    onClose();
  }

  const count = picked.size;
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="place-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <header><span className="dialog-step">Import bookings</span><button className="icon-button" onClick={onClose} aria-label="Close" type="button"><X size={20} /></button></header>
      <h2 id="import-title">{found ? "Here’s what we found" : "Paste a confirmation email"}</h2>
      {!found ? <>
        <p className="import-hint">Copy the whole email from your airline, rail, bus, or hotel booking and paste it here. Tripboard pulls out the dates, times, and places, and you check them before anything is added.</p>
        <textarea aria-label="Confirmation email" autoFocus className="import-text" maxLength={20_000} onChange={(event) => setText(event.target.value)} placeholder="Your booking is confirmed…" rows={9} value={text} />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="flight-dialog-actions"><span /><button className="button button-ink" disabled={reading || text.trim().length < 20} onClick={read} type="button">{reading ? <><Loader2 className="spin" size={16} /> Reading…</> : <><ClipboardPaste size={16} /> Find bookings</>}</button></div>
      </> : <>
        <ul className="import-results">
          {found.journeys.map((journey, index) => {
            const key = `j${index}`;
            const needsTimes = picked.has(key) && !hasTimes(journey);
            return <li className={needsTimes ? "needs-attention" : ""} key={key}>
              <label className="import-pick"><input checked={picked.has(key)} onChange={() => toggle(key)} type="checkbox" /><span className="flight-strip-icon"><JourneyIcon mode={journey.mode} /></span>
                <span><strong>{journey.departureAirport} → {journey.arrivalAirport}</strong><small>{dayLabel(journey.plannedDate)}{journey.arrivalDate !== journey.plannedDate ? ` – ${dayLabel(journey.arrivalDate)}` : ""}{journey.airline || journey.flightNumber ? ` · ${[journey.airline, journey.flightNumber].filter(Boolean).join(" ")}` : ""}</small></span>
              </label>
              <div className="import-times">
                <label><span>Departs</span><input onChange={(event) => updateJourney(index, { departureTime: event.target.value })} required type="time" value={journey.departureTime} /></label>
                <label><span>Arrives</span><input onChange={(event) => updateJourney(index, { arrivalTime: event.target.value })} required type="time" value={journey.arrivalTime} /></label>
              </div>
            </li>;
          })}
          {found.hotels.map((stay, index) => {
            const key = `h${index}`;
            return <li key={key}>
              <label className="import-pick"><input checked={picked.has(key)} onChange={() => toggle(key)} type="checkbox" /><span className="flight-strip-icon"><BedDouble size={16} /></span>
                <span><strong>{stay.name}</strong><small>{dayLabel(stay.startDate)}{stay.endDate !== stay.startDate ? ` – ${dayLabel(stay.endDate)}` : ""} · {stay.address || "Address not in the email"}</small></span>
              </label>
            </li>;
          })}
        </ul>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="flight-dialog-actions">
          <button className="button button-ghost" onClick={() => { setFound(null); setError(""); }} type="button">Paste something else</button>
          <button className="button button-ink" disabled={!count || adding} onClick={addPicked} type="button">{adding ? <><Loader2 className="spin" size={16} /> Adding…</> : `Add ${count} to trip`}</button>
        </div>
      </>}
    </section>
  </div>;
}
