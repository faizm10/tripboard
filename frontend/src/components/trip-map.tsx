"use client";

import { CalendarDays, LocateFixed, MapPin, Minus, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { formatDistance, type MapSuggestion } from "@/lib/assistant/suggestions";
import type { CityLocation } from "@/lib/cities";
import { formatWeekdayDate } from "@/lib/dates";
import { nameNeedsAddressLookup } from "@/lib/google-maps";
import { buildGoogleMapsPlaceUrl } from "@/lib/navigation";
import type { HotelStay, Place } from "@/lib/types";

const FALLBACK_CENTER: [number, number] = [-9.1393, 38.7139];
const previewNameLookups = new Map<string, Promise<string | null>>();

type TripMapProps = {
  destination: string;
  hotels: HotelStay[];
  places: Place[];
  routeCoordinates: [number, number][];
  selectedId: string;
  routeActive: boolean;
  mapToken?: string;
  onSelect: (id: string) => void;
  /** Places the trip assistant suggested, pinned with letters until they're added or cleared. */
  suggestions?: MapSuggestion[];
  focusedSuggestionId?: string | null;
  onFocusSuggestion?: (id: string | null) => void;
  onAddSuggestion?: (suggestion: MapSuggestion) => void;
  onClearSuggestions?: () => void;
};

const NO_SUGGESTIONS: MapSuggestion[] = [];

async function lookupCityLocation(query: string, signal?: AbortSignal): Promise<CityLocation | null> {
  const response = await fetch(`/api/cities/geocode?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) return null;
  const body = (await response.json()) as { coordinates?: [number, number] | null; bbox?: CityLocation["bbox"] };
  if (!body.coordinates) return null;
  return { coordinates: body.coordinates, bbox: body.bbox };
}

function showCity(map: import("mapbox-gl").Map, location: CityLocation, animate: boolean) {
  if (location.bbox) {
    map.fitBounds(
      [
        [location.bbox[0], location.bbox[1]],
        [location.bbox[2], location.bbox[3]],
      ],
      { padding: 56, maxZoom: 13, duration: animate ? 1400 : 0 },
    );
    return;
  }
  if (animate) {
    map.flyTo({ center: location.coordinates, zoom: 12, essential: true, duration: 1400 });
    return;
  }
  map.jumpTo({ center: location.coordinates, zoom: 12 });
}

function previewSubtitle(place: Place) {
  return place.address || place.neighborhood || "Address unavailable";
}

function previewDay(place: Place) {
  return place.plannedDate ? formatWeekdayDate(place.plannedDate) : "Not scheduled";
}

function lookupPreviewName(place: Place) {
  if (!nameNeedsAddressLookup(place.name, place.address)) return Promise.resolve(null);
  const key = `${place.address}:${place.coordinates.join(",")}`;
  const cached = previewNameLookups.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({
    address: place.address,
    lng: String(place.coordinates[0]),
    lat: String(place.coordinates[1]),
  });
  const request = fetch(`/api/places/resolve-name?${params}`)
    .then((response) => response.ok ? response.json() as Promise<{ name?: unknown }> : null)
    .then((body) => typeof body?.name === "string" ? body.name : null)
    .catch(() => null);
  previewNameLookups.set(key, request);
  return request;
}

function isTransitPlace(place: Place) {
  return place.category === "Transit";
}

function mapPlaceLabel(place: Place, index: number) {
  if (isTransitPlace(place)) return "TR";
  return place.plannedDate ? String(index + 1).padStart(2, "0") : "?";
}

function mapPlacePinClass(place: Place, selectedId: string) {
  return `mapbox-place-pin${isTransitPlace(place) ? " transit" : ""}${!place.plannedDate ? " unplanned" : ""}${place.id === selectedId ? " selected" : ""}`;
}

function workspacePlacePinClass(place: Place, selectedId: string) {
  return `workspace-pin${isTransitPlace(place) ? " transit" : ""}${!place.plannedDate ? " unplanned" : ""}${selectedId === place.id ? " selected" : ""}`;
}

function createPreviewCard(place: Place) {
  const card = document.createElement("div");
  card.className = "map-preview-card";

  const copy = document.createElement("span");
  copy.className = "map-preview-copy";

  const title = document.createElement("strong");
  title.textContent = place.name;

  void lookupPreviewName(place).then((name) => {
    if (name) title.textContent = name;
  });

  const day = document.createElement("span");
  day.className = "map-preview-day";
  day.textContent = previewDay(place);

  const addressRow = document.createElement("span");
  addressRow.className = "map-preview-address";

  const subtitle = document.createElement("small");
  subtitle.textContent = previewSubtitle(place);

  const mapsLink = document.createElement("a");
  mapsLink.href = buildGoogleMapsPlaceUrl(place);
  mapsLink.target = "_blank";
  mapsLink.rel = "noreferrer";
  mapsLink.ariaLabel = `Open ${place.name} in Google Maps`;
  mapsLink.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 4.8-5.4 10.3-7.4 12.2a.9.9 0 0 1-1.2 0C9.4 20.3 4 14.8 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>';

  addressRow.append(subtitle, mapsLink);
  copy.append(title, day, addressRow);
  card.append(copy);
  return card;
}

function createHotelPreviewCard(hotel: HotelStay) {
  const card = document.createElement("div");
  card.className = "map-preview-card hotel-preview-card";
  const copy = document.createElement("span");
  copy.className = "map-preview-copy";
  const title = document.createElement("strong");
  title.textContent = hotel.name;
  const subtitle = document.createElement("small");
  subtitle.textContent = hotel.address || "Home base";
  copy.append(title, subtitle);
  card.append(copy);
  return card;
}

function suggestionMeta(suggestion: MapSuggestion) {
  return [suggestion.category, suggestion.neighborhood, suggestion.fromHotel ? `${formatDistance(suggestion.fromHotel.meters)} from hotel` : ""].filter(Boolean).join(" · ");
}

function suggestionAddLabel(suggestion: MapSuggestion) {
  return suggestion.plannedDate ? `Add to ${formatWeekdayDate(suggestion.plannedDate)}` : "Add to trip";
}

function createSuggestionCard(suggestion: MapSuggestion, onAdd: () => void) {
  const card = document.createElement("div");
  card.className = "map-preview-card suggestion-preview-card";
  const kicker = document.createElement("span");
  kicker.className = "suggestion-preview-kicker";
  kicker.textContent = `AI pick ${suggestion.label}`;
  const title = document.createElement("strong");
  title.textContent = suggestion.name;
  const meta = document.createElement("small");
  meta.textContent = suggestionMeta(suggestion);
  card.append(kicker, title, meta);
  if (suggestion.reason) {
    const reason = document.createElement("p");
    reason.textContent = suggestion.reason;
    card.append(reason);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "suggestion-preview-add";
  add.textContent = `+ ${suggestionAddLabel(suggestion)}`;
  add.addEventListener("click", (event) => {
    event.stopPropagation();
    onAdd();
  });
  card.append(add);
  return card;
}

function MapPlacePreview({ place }: { place: Place }) {
  const [resolvedTitle, setResolvedTitle] = useState<{ address: string; name: string } | null>(null);

  useEffect(() => {
    let active = true;
    void lookupPreviewName(place).then((name) => {
      if (active && name) setResolvedTitle({ address: place.address, name });
    });
    return () => { active = false; };
  }, [place]);
  const title = resolvedTitle?.address === place.address ? resolvedTitle.name : place.name;

  return (
    <span className="map-preview-card">
      <span className="map-preview-copy">
        <strong>{title}</strong>
        <span className="map-preview-day"><CalendarDays size={12} />{previewDay(place)}</span>
        <span className="map-preview-address">
          <small>{previewSubtitle(place)}</small>
          <a
            href={buildGoogleMapsPlaceUrl(place)}
            aria-label={`Open ${place.name} in Google Maps`}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            <MapPin size={14} />
          </a>
        </span>
      </span>
    </span>
  );
}

function MapHotelPreview({ hotel }: { hotel: HotelStay }) {
  return <span className="map-preview-card hotel-preview-card"><span className="map-preview-copy"><strong>{hotel.name}</strong><small>{hotel.address || "Home base"}</small></span></span>;
}

export function TripMap({
  destination,
  hotels,
  places,
  routeCoordinates,
  selectedId,
  routeActive,
  mapToken,
  onSelect,
  suggestions = NO_SUGGESTIONS,
  focusedSuggestionId = null,
  onFocusSuggestion,
  onAddSuggestion,
  onClearSuggestions,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const mapboxRef = useRef<typeof import("mapbox-gl").default | null>(null);
  const markersRef = useRef<Map<string, import("mapbox-gl").Marker>>(new Map());
  const popupsRef = useRef<Map<string, import("mapbox-gl").Popup>>(new Map());
  const suggestionMarkersRef = useRef<Map<string, { marker: import("mapbox-gl").Marker; popup: import("mapbox-gl").Popup; wrapper: HTMLElement }>>(new Map());
  const fittedSuggestionsRef = useRef("");
  const suggestionKey = suggestions.map((item) => item.fsqPlaceId).join("|");
  const focusSuggestion = useEffectEvent((id: string | null) => onFocusSuggestion?.(id));
  const addSuggestion = useEffectEvent((suggestion: MapSuggestion) => onAddSuggestion?.(suggestion));
  const shownDestinationRef = useRef("");
  const initialDestinationRef = useRef(destination);
  const [mapReady, setMapReady] = useState(false);
  const unplannedCount = places.filter((place) => !place.plannedDate).length;
  const transitCount = places.filter(isTransitPlace).length;
  const routeSignature = routeCoordinates.map(([lng, lat]) => `${lng},${lat}`).join("|");
  const routeData = useMemo(() => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: routeSignature ? routeSignature.split("|").map((pair) => pair.split(",").map(Number) as [number, number]) : [] },
  }), [routeSignature]);

  useEffect(() => {
    if (!mapToken || !containerRef.current) return;
    let active = true;
    const markerMap = markersRef.current;
    const popupMap = popupsRef.current;
    const suggestionMap = suggestionMarkersRef.current;
    const openingDestination = initialDestinationRef.current;

    async function mountMap() {
      const mapboxPackage = await import("mapbox-gl");
      const location = await lookupCityLocation(openingDestination).catch(() => null);
      if (!active || !containerRef.current) return;
      const mapboxgl = mapboxPackage.default;
      mapboxRef.current = mapboxgl;
      mapboxgl.accessToken = mapToken;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: location?.coordinates ?? FALLBACK_CENTER,
        zoom: 12,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.on("load", () => {
        if (location) {
          showCity(map, location, false);
          shownDestinationRef.current = openingDestination;
        }
        setMapReady(true);
      });
    }

    mountMap();
    return () => {
      active = false;
      popupMap.forEach((popup) => popup.remove());
      popupMap.clear();
      markerMap.forEach((marker) => marker.remove());
      markerMap.clear();
      suggestionMap.forEach(({ marker, popup }) => { popup.remove(); marker.remove(); });
      suggestionMap.clear();
      fittedSuggestionsRef.current = "";
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
      shownDestinationRef.current = "";
    };
  }, [mapToken]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!mapReady || !map || !container) return;
    // Mobile toggles the map with display:none. Mapbox only watches window
    // resize, so observe its actual container when the map becomes visible.
    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      map.resize();
      const coordinates = routeData.geometry.coordinates;
      if (!coordinates.length) return;
      const lngs = coordinates.map(([lng]) => lng);
      const lats = coordinates.map(([, lat]) => lat);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
        padding: { top: 64, right: 44, bottom: Math.min(140, container.clientHeight / 4), left: 44 },
        maxZoom: 15,
        duration: 0,
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [mapReady, routeData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !destination.trim()) return;
    if (shownDestinationRef.current === destination) return;
    const controller = new AbortController();
    lookupCityLocation(destination, controller.signal)
      .then((location) => {
        if (!location || !mapRef.current) return;
        showCity(mapRef.current, location, true);
        shownDestinationRef.current = destination;
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [destination, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapReady || !map || !mapboxgl) return;

    popupsRef.current.forEach((popup) => popup.remove());
    popupsRef.current.clear();
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    for (const hotel of hotels) {
      const wrapper = document.createElement("div");
      wrapper.className = "mapbox-marker-with-preview mapbox-hotel-marker";
      const element = document.createElement("button");
      element.className = "mapbox-hotel-pin";
      element.type = "button";
      element.ariaLabel = `Hotel: ${hotel.name}`;
      element.textContent = "H";
      wrapper.append(element);
      const previewCard = createHotelPreviewCard(hotel);
      const popup = new mapboxgl.Popup({ className: "place-map-popup", closeButton: false, closeOnClick: false, focusAfterOpen: false, maxWidth: "260px", offset: 18 }).setDOMContent(previewCard);
      const showPreview = () => { wrapper.classList.add("preview-open"); popup.setLngLat(hotel.coordinates).addTo(map); };
      const hidePreview = () => { wrapper.classList.remove("preview-open"); popup.remove(); };
      element.addEventListener("mouseenter", showPreview); element.addEventListener("focus", showPreview);
      element.addEventListener("mouseleave", hidePreview); element.addEventListener("blur", hidePreview);
      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "bottom" }).setLngLat(hotel.coordinates).addTo(map);
      markersRef.current.set(`hotel-${hotel.id}`, marker); popupsRef.current.set(`hotel-${hotel.id}`, popup);
    }
    for (const [index, place] of places.entries()) {
      const wrapper = document.createElement("div");
      wrapper.className = "mapbox-marker-with-preview";
      const element = document.createElement("button");
      const unplanned = !place.plannedDate;
      element.className = mapPlacePinClass(place, selectedId);
      element.type = "button";
      element.ariaLabel = `Select ${place.name}, ${unplanned ? "needs a day" : `planned for ${place.plannedDate}`}, ${place.category}, ${previewSubtitle(place)}`;
      element.textContent = mapPlaceLabel(place, index);
      element.addEventListener("click", () => onSelect(place.id));
      wrapper.append(element);
      const previewCard = createPreviewCard(place);
      const popup = new mapboxgl.Popup({
        className: "place-map-popup",
        closeButton: false,
        closeOnClick: false,
        focusAfterOpen: false,
        maxWidth: "260px",
        offset: 18,
      }).setDOMContent(previewCard);
      let closeTimer: number | null = null;
      const clearCloseTimer = () => {
        if (!closeTimer) return;
        window.clearTimeout(closeTimer);
        closeTimer = null;
      };
      const showPreview = () => {
        clearCloseTimer();
        wrapper.classList.add("preview-open");
        popup.setLngLat(place.coordinates).addTo(map);
      };
      const hidePreview = () => {
        clearCloseTimer();
        closeTimer = window.setTimeout(() => {
          wrapper.classList.remove("preview-open");
          popup.remove();
        }, 120);
      };
      element.addEventListener("mouseenter", showPreview);
      element.addEventListener("focus", showPreview);
      element.addEventListener("mouseleave", hidePreview);
      element.addEventListener("blur", hidePreview);
      previewCard.addEventListener("mouseenter", clearCloseTimer);
      previewCard.addEventListener("mouseleave", hidePreview);
      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "bottom" }).setLngLat(place.coordinates).addTo(map);
      markersRef.current.set(place.id, marker);
      popupsRef.current.set(place.id, popup);
    }

  }, [hotels, mapReady, onSelect, places, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapReady || !map || !mapboxgl) return;
    const markers = suggestionMarkersRef.current;
    markers.forEach(({ marker, popup }) => { popup.remove(); marker.remove(); });
    markers.clear();
    for (const suggestion of suggestions) {
      const wrapper = document.createElement("div");
      wrapper.className = "mapbox-marker-with-preview mapbox-suggestion-marker";
      const element = document.createElement("button");
      element.className = "mapbox-suggestion-pin";
      element.type = "button";
      element.ariaLabel = `AI suggestion ${suggestion.label}: ${suggestion.name}, ${suggestion.category}`;
      element.textContent = suggestion.label;
      wrapper.append(element);
      const popup = new mapboxgl.Popup({ className: "place-map-popup suggestion-map-popup", closeButton: false, closeOnClick: false, focusAfterOpen: false, maxWidth: "270px", offset: 20 })
        .setDOMContent(createSuggestionCard(suggestion, () => addSuggestion(suggestion)));
      let closeTimer: number | null = null;
      const keepOpen = () => { if (closeTimer) window.clearTimeout(closeTimer); closeTimer = null; };
      const show = () => { keepOpen(); wrapper.classList.add("preview-open"); popup.setLngLat(suggestion.coordinates).addTo(map); };
      const hide = () => {
        keepOpen();
        closeTimer = window.setTimeout(() => {
          if (wrapper.classList.contains("focused")) return;
          wrapper.classList.remove("preview-open");
          popup.remove();
        }, 160);
      };
      element.addEventListener("mouseenter", show);
      element.addEventListener("focus", show);
      element.addEventListener("mouseleave", hide);
      element.addEventListener("blur", hide);
      element.addEventListener("click", () => focusSuggestion(wrapper.classList.contains("focused") ? null : suggestion.fsqPlaceId));
      // The popup element only exists once it opens; the same listener is never added twice.
      popup.on("open", () => {
        popup.getElement()?.addEventListener("mouseenter", keepOpen);
        popup.getElement()?.addEventListener("mouseleave", hide);
      });
      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "bottom" }).setLngLat(suggestion.coordinates).addTo(map);
      markers.set(suggestion.fsqPlaceId, { marker, popup, wrapper });
    }
  }, [mapReady, suggestions]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    for (const [id, { popup, wrapper, marker }] of suggestionMarkersRef.current) {
      const focused = id === focusedSuggestionId;
      wrapper.classList.toggle("focused", focused);
      if (focused) {
        wrapper.classList.add("preview-open");
        popup.setLngLat(marker.getLngLat()).addTo(map);
        map.flyTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 14), essential: true, duration: 900 });
      } else if (wrapper.classList.contains("preview-open") && !wrapper.matches(":hover")) {
        wrapper.classList.remove("preview-open");
        popup.remove();
      }
    }
  }, [focusedSuggestionId, mapReady, suggestions]);

  useEffect(() => {
    // Bring a fresh batch of AI picks into view once, without fighting the user's panning afterwards.
    const map = mapRef.current;
    const container = containerRef.current;
    if (!mapReady || !map || !container || !suggestionKey || focusedSuggestionId) return;
    if (fittedSuggestionsRef.current === suggestionKey) return;
    const previous = new Set(fittedSuggestionsRef.current.split("|"));
    fittedSuggestionsRef.current = suggestionKey;
    const fresh = suggestions.filter((item) => !previous.has(item.fsqPlaceId));
    const focus = fresh.length ? fresh : suggestions;
    if (focus.length === 1) {
      map.flyTo({ center: focus[0].coordinates, zoom: Math.max(map.getZoom(), 14), essential: true, duration: 900 });
      return;
    }
    const lngs = focus.map(({ coordinates: [lng] }) => lng);
    const lats = focus.map(({ coordinates: [, lat] }) => lat);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
      padding: { top: 80, right: 60, bottom: Math.min(140, container.clientHeight / 4), left: 60 },
      maxZoom: 15,
      duration: 900,
    });
  }, [focusedSuggestionId, mapReady, suggestionKey, suggestions]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const source = map.getSource("trip-route") as import("mapbox-gl").GeoJSONSource | undefined;
    if (routeActive && routeData.geometry.coordinates.length >= 2) {
      if (source) source.setData(routeData);
      else {
        map.addSource("trip-route", { type: "geojson", data: routeData });
        map.addLayer({ id: "trip-route-line", type: "line", source: "trip-route", paint: { "line-color": "#111111", "line-width": 4, "line-dasharray": [0.8, 1.6] } });
      }
    } else if (source) {
      if (map.getLayer("trip-route-line")) map.removeLayer("trip-route-line");
      map.removeSource("trip-route");
    }
  }, [mapReady, routeActive, routeData]);

  function zoom(delta: number) {
    mapRef.current?.zoomTo(mapRef.current.getZoom() + delta);
  }

  if (mapToken) {
    return (
      <div className="real-map-wrap">
        <div className="real-map" ref={containerRef} />
        {unplannedCount || transitCount ? <MapLegend transitCount={transitCount} unplannedCount={unplannedCount} /> : null}
        <SuggestionChip count={suggestions.length} onClear={onClearSuggestions} />
        <div className="map-controls"><button type="button" onClick={() => zoom(1)} aria-label="Zoom in"><Plus size={17} /></button><button type="button" onClick={() => zoom(-1)} aria-label="Zoom out"><Minus size={17} /></button></div>
      </div>
    );
  }

  const positions = [
    { left: "63%", top: "60%" },
    { left: "35%", top: "24%" },
    { left: "44%", top: "50%" },
    { left: "78%", top: "36%" },
    { left: "26%", top: "76%" },
    { left: "70%", top: "18%" },
  ];

  return (
    <div className="demo-map" aria-label="Interactive demo map of saved places">
      <div className="demo-map-grid" />
      <div className="demo-map-water"><span>RIO TEJO</span></div>
      <div className="demo-road road-a"><span>AV. DA LIBERDADE</span></div>
      <div className="demo-road road-b" />
      <div className="demo-road road-c" />
      <div className="demo-park park-a">JARDIM<br />DA ESTRELA</div>
      <div className="demo-park park-b">GRAÇA</div>
      {routeActive && (
        <svg className="workspace-route" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
          <path d="M630 420 C 510 340, 270 235, 350 168 S 460 335, 440 350 S 650 175, 780 252 S 445 620, 260 532" />
        </svg>
      )}
      {places.map((place, index) => {
        return (
          <div
            className={workspacePlacePinClass(place, selectedId)}
            style={positions[index % positions.length]}
            key={place.id}
          >
            <button
              className="workspace-pin-button"
              onClick={() => onSelect(place.id)}
              aria-label={`Select ${place.name}, ${place.plannedDate ? `planned for ${place.plannedDate}` : "needs a day"}, ${place.category}, ${previewSubtitle(place)}`}
              type="button"
            >
              {mapPlaceLabel(place, index)}
            </button>
            <MapPlacePreview place={place} />
          </div>
        );
      })}
      {suggestions.map((suggestion, index) => (
        <div
          className={`workspace-pin workspace-suggestion-pin${focusedSuggestionId === suggestion.fsqPlaceId ? " selected" : ""}`}
          key={`suggestion-${suggestion.fsqPlaceId}`}
          style={suggestionPositions[index % suggestionPositions.length]}
        >
          <button
            aria-label={`AI suggestion ${suggestion.label}: ${suggestion.name}`}
            className="workspace-pin-button"
            onClick={() => onFocusSuggestion?.(focusedSuggestionId === suggestion.fsqPlaceId ? null : suggestion.fsqPlaceId)}
            type="button"
          >
            {suggestion.label}
          </button>
          <span className="map-preview-card suggestion-preview-card">
            <span className="suggestion-preview-kicker">AI pick {suggestion.label}</span>
            <strong>{suggestion.name}</strong>
            <small>{suggestionMeta(suggestion)}</small>
            {suggestion.reason ? <p>{suggestion.reason}</p> : null}
            <button className="suggestion-preview-add" onClick={() => onAddSuggestion?.(suggestion)} type="button">+ {suggestionAddLabel(suggestion)}</button>
          </span>
        </div>
      ))}
      {hotels.map((hotel, index) => <div className="workspace-pin workspace-hotel-pin" style={positions[(index + places.length + 2) % positions.length]} key={`hotel-${hotel.id}`}><button className="workspace-pin-button" aria-label={`Hotel: ${hotel.name}`} type="button">H</button><MapHotelPreview hotel={hotel} /></div>)}
      <div className="map-demo-label">Map preview · {destination || "Add a Mapbox key for live tiles"}</div>
      {unplannedCount || transitCount ? <MapLegend transitCount={transitCount} unplannedCount={unplannedCount} /> : null}
      <SuggestionChip count={suggestions.length} onClear={onClearSuggestions} />
      <div className="map-controls"><button type="button" aria-label="Zoom in"><Plus size={17} /></button><button type="button" aria-label="Zoom out"><Minus size={17} /></button><button type="button" aria-label="Find me"><LocateFixed size={17} /></button></div>
    </div>
  );
}

const suggestionPositions = [
  { left: "54%", top: "32%" },
  { left: "30%", top: "44%" },
  { left: "72%", top: "70%" },
  { left: "48%", top: "78%" },
  { left: "84%", top: "52%" },
  { left: "20%", top: "30%" },
];

function SuggestionChip({ count, onClear }: { count: number; onClear?: () => void }) {
  if (!count) return null;
  return (
    <div className="map-suggestion-chip" role="status">
      <Sparkles size={13} aria-hidden="true" />
      <span>{count} AI {count === 1 ? "pick" : "picks"} on the map</span>
      {onClear ? <button aria-label="Clear AI picks from the map" onClick={onClear} title="Clear" type="button"><X size={13} /></button> : null}
    </div>
  );
}

function MapLegend({ transitCount, unplannedCount }: { transitCount: number; unplannedCount: number }) {
  return (
    <aside className="map-legend" aria-label="Map legend">
      <span className="map-legend-key planned">01</span>
      <span>Assigned to a day</span>
      {transitCount ? <><span className="map-legend-key transit">TR</span><span>{transitCount} transit {transitCount === 1 ? "stop" : "stops"}</span></> : null}
      {unplannedCount ? <><span className="map-legend-key unplanned">?</span><span>{unplannedCount} needs a day</span></> : null}
    </aside>
  );
}
