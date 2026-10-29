"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BedDouble, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { suggestHotelRange } from "@/lib/hotel-dates";
import type { CityStop, Flight, HotelStay, PlaceSearchResult } from "@/lib/types";

export type HotelStayDraft = Omit<HotelStay, "id">;

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function HotelStayDialog({ cities, dates, destination, flights, hotel, hotels, initialDate, onClose, onDelete, onSave }: {
  cities: CityStop[];
  dates: string[];
  destination: string;
  flights: Flight[];
  hotel?: HotelStay | null;
  hotels: HotelStay[];
  initialDate: string;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onSave: (stay: HotelStayDraft) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceSearchResult | null>(hotel ? { fsqPlaceId: "", name: hotel.name, address: hotel.address, neighborhood: "", coordinates: hotel.coordinates, category: "Stay" } : null);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState(hotel?.name ?? "");
  const [address, setAddress] = useState(hotel?.address ?? "");
  const [coordinates, setCoordinates] = useState<[number, number] | null>(hotel?.coordinates ?? null);
  const initialCity = cities.find((city) => city.id === hotel?.cityId)
    ?? cities.find((city) => city.startDate && city.endDate && city.startDate <= initialDate && city.endDate >= initialDate)
    ?? cities[0];
  const suggestRange = (city: CityStop | undefined) => suggestHotelRange({ city, dates, flights, hotels: hotels.filter((stay) => stay.id !== hotel?.id), startDate: initialDate });
  const [cityId, setCityId] = useState(hotel?.cityId ?? initialCity?.id ?? "");
  const [suggested] = useState(() => hotel ? null : suggestRange(initialCity));
  const [startDate, setStartDate] = useState(hotel?.startDate ?? suggested?.startDate ?? initialDate);
  const [endDate, setEndDate] = useState(hotel?.endDate ?? suggested?.endDate ?? initialDate);
  // New stays follow the city until someone picks the days themselves.
  const [datesAuto, setDatesAuto] = useState(!hotel);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selected && !manual) inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [manual, onClose, selected]);

  const search = useQuery({
    queryKey: ["hotel-search", query, destination],
    queryFn: async () => {
      const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query)}&near=${encodeURIComponent(destination)}`);
      if (!response.ok) throw new Error("Hotel search is unavailable right now.");
      return (await response.json()) as { results: PlaceSearchResult[] };
    },
    enabled: query.trim().length >= 2 && !manual,
  });

  async function locateAddress() {
    if (!address.trim()) return;
    const response = await fetch(`/api/cities/geocode?q=${encodeURIComponent(address)}`);
    const body = await response.json() as { coordinates?: [number, number] | null };
    if (!body.coordinates) { setError("That address could not be located. Try a fuller address."); return; }
    setCoordinates(body.coordinates);
    setError("");
  }

  function chooseCity(nextCityId: string) {
    setCityId(nextCityId);
    if (!datesAuto) return;
    const range = suggestRange(cities.find((city) => city.id === nextCityId));
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function chooseStart(date: string) {
    setDatesAuto(false);
    setStartDate(date);
    if (endDate < date) setEndDate(date);
  }

  const dayCount = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;

  function save() {
    const source = selected ?? (coordinates ? { name, address, coordinates } : null);
    if (!source || !source.name.trim() || !coordinates && !selected) { setError("Choose a hotel or pin a full address first."); return; }
    if (endDate < startDate) { setError("The last hotel day must be on or after the first."); return; }
    onSave({ cityId, name: source.name.trim(), address: source.address.trim(), coordinates: selected?.coordinates ?? coordinates!, startDate, endDate });
    onClose();
  }

  const choosing = !selected && !manual;
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="place-dialog hotel-dialog" role="dialog" aria-modal="true" aria-labelledby="hotel-title">
      <header>{!choosing ? <button className="icon-button" onClick={() => { setSelected(null); setManual(false); }} aria-label="Back to hotel search"><ArrowLeft size={19} /></button> : <span className="dialog-step">Where you&apos;re staying</span>}<button className="icon-button" onClick={onClose} aria-label="Close" type="button"><X size={20} /></button></header>
      {choosing ? <>
        <h2 id="hotel-title">Add a hotel</h2>
        <div className="place-search-box"><Search size={20} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search hotels in ${destination}`} aria-label="Search hotels" /></div>
        <p className="search-hint">Pick a result or <button className="inline-action" onClick={() => setManual(true)} type="button">pin an address manually</button>.</p>
        <div className="search-results" aria-live="polite">
          {search.isFetching ? <p className="search-state">Looking for a stay…</p> : null}
          {search.data?.results.map((place) => <button className="search-result" onClick={() => setSelected(place)} key={place.fsqPlaceId} type="button"><span className="result-pin"><BedDouble size={17} /></span><span><strong>{place.name}</strong><small>{place.address}</small></span><span className="category-tag result-category category-stay">Stay</span></button>)}
          {query.length < 2 ? <div className="search-empty"><span>FIND YOUR<br />HOME BASE.</span></div> : null}
        </div>
      </> : <>
        <p className="eyebrow"><BedDouble size={13} /> Hotel stay</p>
        <h2 id="hotel-title">{selected?.name || name || "Pin a hotel"}</h2>
        {manual ? <>
          <label className="field-label"><span>Hotel name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Hotel name" /></label>
          <label className="field-label"><span>Address</span><div className="url-input"><MapPin size={16} /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, country" /></div></label>
          <button className="button button-ghost hotel-locate" onClick={locateAddress} type="button">{coordinates ? "Address pinned" : "Pin this address"} <MapPin size={16} /></button>
        </> : <p className="selected-address"><MapPin size={15} /> {selected?.address}</p>}
        <div className="hotel-date-grid">
          <label className="field-label"><span>City</span><select value={cityId} onChange={(event) => chooseCity(event.target.value)}>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
          <label className="field-label"><span>From</span><select value={startDate} onChange={(event) => chooseStart(event.target.value)}>{dates.map((date) => <option key={date} value={date}>{dayLabel(date)}</option>)}</select></label>
          <label className="field-label"><span>Through</span><select value={endDate} onChange={(event) => { setDatesAuto(false); setEndDate(event.target.value); }}>{dates.map((date) => <option key={date} value={date}>{dayLabel(date)}</option>)}</select></label>
        </div>
        <p className="hotel-date-hint">{datesAuto && dayCount > 0 ? `Filled in ${dayCount} ${dayCount === 1 ? "day" : "days"} from your trip. ` : ""}The hotel is your route start on every included day.</p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="flight-dialog-actions">{hotel && onDelete ? <button className="button button-ghost" onClick={() => { onDelete(hotel.id); onClose(); }} type="button">Remove stay</button> : <span />}<button className="button button-ink" onClick={save} type="button">Save hotel</button></div>
      </>}
    </section>
  </div>;
}
