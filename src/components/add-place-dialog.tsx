"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BedDouble, CalendarDays, Coffee, ExternalLink, Landmark, MapPin, Search, ShoppingBag, TramFront, Utensils, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PLACE_CATEGORIES, categoryClass, type Place, type PlaceCategory, type PlaceSearchResult } from "@/lib/types";

const categoryIcons = {
  Eat: Utensils,
  Drink: Coffee,
  See: Landmark,
  Shop: ShoppingBag,
  Stay: BedDouble,
  Transit: TramFront,
  Other: MapPin,
} satisfies Record<PlaceCategory, typeof MapPin>;

type AddPlaceDialogProps = {
  destination: string;
  initialPlannedDate?: string | null;
  dates?: string[];
  onAdd: (place: Place) => void;
  onClose: () => void;
};

function formatSaveDay(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const weekday = date.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" });
  const calendarDate = date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${weekday} · ${calendarDate}`;
}

export function AddPlaceDialog({ destination, initialPlannedDate, dates = [], onAdd, onClose }: AddPlaceDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceSearchResult | null>(null);
  const [category, setCategory] = useState<PlaceCategory>("Other");
  const [plannedDate, setPlannedDate] = useState(initialPlannedDate && dates.includes(initialPlannedDate) ? initialPlannedDate : "");
  const [note, setNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  // Places belong to the whole trip. "Near" only steers the search, so a
  // multi-city trip can still find a spot in the next town over.
  const [near, setNear] = useState(destination);
  const searchDestination = near.trim() || destination;

  useEffect(() => {
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const search = useQuery({
    queryKey: ["place-search", query, searchDestination],
    queryFn: async () => {
      const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query)}&near=${encodeURIComponent(searchDestination)}`);
      if (!response.ok) throw new Error("Search is taking the scenic route. Try again.");
      return (await response.json()) as { results: PlaceSearchResult[]; demo: boolean };
    },
    enabled: query.trim().length >= 2,
  });

  function choose(place: PlaceSearchResult) {
    setSelected(place);
    setCategory(place.category);
  }

  function save() {
    if (!selected) return;
    onAdd({
      ...selected,
      id: `local-${Date.now()}`,
      category,
      note,
      sourceUrl: sourceUrl || undefined,
      saved: true,
      plannedDate: plannedDate || null,
      daySortOrder: 0,
      addedBy: "FM",
    });
    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="place-dialog" role="dialog" aria-modal="true" aria-labelledby="add-place-title">
        <header>
          {selected ? <button className="icon-button" onClick={() => setSelected(null)} aria-label="Back to search"><ArrowLeft size={19} /></button> : <span className="dialog-step">Add a place</span>}
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {!selected ? (
          <>
            <h2 id="add-place-title">What&apos;s worth a stop?</h2>
            <div className="place-search-box"><Search size={20} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${searchDestination}`} aria-label="Search places" /></div>
            <label className="search-near"><span>Near</span><input value={near} onChange={(event) => setNear(event.target.value)} placeholder={destination} aria-label="Search near" /></label>
            <p className="search-hint">Search a restaurant, shop, landmark, transit stop, or address.</p>
            <div className="search-results" aria-live="polite">
              {search.isFetching && <p className="search-state">Looking around…</p>}
              {search.isError && <p className="form-error">{search.error.message}</p>}
              {search.data?.results.map((place) => {
                const Icon = categoryIcons[place.category];
                return (
                  <button className="search-result" onClick={() => choose(place)} key={place.fsqPlaceId} type="button">
                    <span className={`result-pin ${categoryClass(place.category)}`}><Icon size={17} /></span>
                    <span><strong>{place.name}</strong><small>{place.address} · {place.neighborhood}</small></span>
                    <span className={`category-tag result-category ${categoryClass(place.category)}`}>{place.category}</span>
                  </button>
                );
              })}
              {query.length < 2 && <div className="search-empty"><span>PASTE IT.<br />FIND IT.<br />PIN IT.</span></div>}
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">New save</p>
            <h2 id="add-place-title">{selected.name}</h2>
            <p className="selected-address"><MapPin size={15} /> {selected.address}</p>
            <div className="field-label">
              <span>Category</span>
              <div className="category-picker" role="radiogroup" aria-label="Category">
                {PLACE_CATEGORIES.map((item) => (
                  <button
                    aria-checked={category === item}
                    className={`category-tag ${categoryClass(item)}${category === item ? " active" : ""}`}
                    key={item}
                    onClick={() => setCategory(item)}
                    role="radio"
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <label className="field-label"><span>Your note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why did you save this? What should the group know?" rows={4} maxLength={500} /></label>
            <label className="field-label">
              <span>Plan day <small>(optional)</small></span>
              <div className="day-select-input">
                <CalendarDays size={16} />
                <select value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} aria-label="Optional planned day">
                  <option value="">Save without a day</option>
                  {dates.map((date) => <option value={date} key={date}>{formatSaveDay(date)}</option>)}
                </select>
              </div>
            </label>
            <label className="field-label"><span>Where you found it <small>(optional)</small></span><div className="url-input"><ExternalLink size={16} /><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Instagram, TikTok, article…" /></div></label>
            <button className="button button-ink button-full" onClick={save} type="button">Save to trip <MapPin size={17} /></button>
          </>
        )}
      </section>
    </div>
  );
}
