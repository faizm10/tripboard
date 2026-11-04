"use client";

import { CalendarDays, ExternalLink, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLACE_CATEGORIES, categoryClass, type Place, type PlaceCategory } from "@/lib/types";

export type PlaceEditDraft = {
  name: string;
  address: string;
  neighborhood: string;
  category: PlaceCategory;
  note: string;
  sourceUrl?: string;
  cityId?: string | null;
  plannedDate?: string | null;
};

function formatSaveDay(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const weekday = date.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" });
  const calendarDate = date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${weekday} · ${calendarDate}`;
}

export function EditPlaceDialog({
  dates = [],
  onClose,
  onSave,
  place,
}: {
  dates?: string[];
  onClose: () => void;
  onSave: (placeId: string, draft: PlaceEditDraft) => void;
  place: Place;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [category, setCategory] = useState<PlaceCategory>(place.category);
  const [plannedDate, setPlannedDate] = useState(place.plannedDate ?? "");

  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    onSave(place.id, {
      name,
      address: String(form.get("address") ?? "").trim(),
      neighborhood: String(form.get("neighborhood") ?? "").trim(),
      category,
      note: String(form.get("note") ?? "").trim(),
      sourceUrl: String(form.get("sourceUrl") ?? "").trim() || undefined,
      plannedDate: plannedDate || null,
    });
    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="place-dialog edit-place-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-place-title" tabIndex={-1}>
        <header>
          <span className="dialog-step">Edit place</span>
          <button className="icon-button" onClick={onClose} aria-label="Close" type="button"><X size={20} /></button>
        </header>
        <p className="eyebrow">Saved stop</p>
        <h2 id="edit-place-title">{place.name}</h2>
        <form className="edit-place-form" onSubmit={submit}>
          <label className="field-label"><span>Name</span><input defaultValue={place.name} name="name" required maxLength={200} /></label>
          <div className="edit-place-grid">
            <label className="field-label"><span>Neighborhood</span><input defaultValue={place.neighborhood} name="neighborhood" maxLength={120} placeholder="Area or station district" /></label>
            <label className="field-label"><span>Address</span><div className="url-input"><MapPin size={16} /><input defaultValue={place.address} name="address" maxLength={300} placeholder="Street, city, country" /></div></label>
          </div>
          <div className="field-label">
            <span>Category</span>
            <div className="category-picker" role="radiogroup" aria-label={`Category for ${place.name}`}>
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
          <label className="field-label"><span>Note</span><textarea defaultValue={place.note} name="note" placeholder="What should everyone know before they go?" rows={4} maxLength={500} /></label>
          <label className="field-label">
            <span>Plan day <small>Optional</small></span>
            <div className="day-select-input">
              <CalendarDays size={16} />
              <select value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} aria-label={`Planned day for ${place.name}`}>
                <option value="">Save without a day</option>
                {dates.map((date) => <option value={date} key={date}>{formatSaveDay(date)}</option>)}
              </select>
            </div>
          </label>
          <label className="field-label"><span>Where you found it <small>Optional</small></span><div className="url-input"><ExternalLink size={16} /><input defaultValue={place.sourceUrl ?? ""} name="sourceUrl" placeholder="Instagram, TikTok, article..." type="url" /></div></label>
          <div className="flight-dialog-actions"><span /><button className="button button-ink" type="submit">Save changes</button></div>
        </form>
      </section>
    </div>
  );
}
