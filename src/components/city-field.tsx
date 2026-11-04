"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CitySuggestion } from "@/lib/cities";

export function CityField({
  defaultValue = "",
  onCityChange,
}: {
  defaultValue?: string;
  /** Fires when a city is picked from the list, so callers can react to the destination. */
  onCityChange?: (label: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [debounced, setDebounced] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(defaultValue);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const search = useQuery({
    queryKey: ["city-search", debounced],
    queryFn: async () => {
      const response = await fetch(`/api/cities/autocomplete?q=${encodeURIComponent(debounced)}`);
      if (!response.ok) throw new Error("City search is taking a moment. Try again.");
      return (await response.json()) as { results: CitySuggestion[]; demo: boolean };
    },
    enabled: debounced.length >= 2,
  });

  const results = search.data?.results ?? [];

  function choose(city: CitySuggestion) {
    setQuery(city.label);
    setSelected(city.label);
    setOpen(false);
    onCityChange?.(city.label);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && results[active]) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="city-field" ref={rootRef}>
      <span>
        <MapPin size={15} /> Where are you going?
      </span>
      <input type="hidden" name="destination" value={selected} />
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && results.length > 0}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected("");
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Start typing a city or country"
        role="combobox"
        required={!selected}
        spellCheck={false}
        value={query}
      />
      {open && debounced.length >= 2 ? (
        <ul className="city-suggestions" id={listId} role="listbox">
          {search.isFetching ? <li className="city-suggestion-state">Looking for places…</li> : null}
          {search.isError ? <li className="city-suggestion-state">{search.error.message}</li> : null}
          {results.map((city, index) => (
            <li key={city.id} role="presentation">
              <button
                aria-selected={index === active}
                className={index === active ? "city-suggestion active" : "city-suggestion"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(city)}
                role="option"
                type="button"
              >
                <span>{city.name}</span>
                <small>{city.kind === "country" ? "Country" : (city.country ?? city.region ?? city.label)}</small>
              </button>
            </li>
          ))}
          {!search.isFetching && !search.isError && results.length === 0 ? (
            <li className="city-suggestion-state">No cities or countries match that yet.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
