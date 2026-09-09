"use client";

import { CalendarDays, LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
};

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

export function TripMap({ destination, hotels, places, routeCoordinates, selectedId, routeActive, mapToken, onSelect }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const mapboxRef = useRef<typeof import("mapbox-gl").default | null>(null);
  const markersRef = useRef<Map<string, import("mapbox-gl").Marker>>(new Map());
  const popupsRef = useRef<Map<string, import("mapbox-gl").Popup>>(new Map());
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
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
      shownDestinationRef.current = "";
    };
  }, [mapToken]);

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
      {hotels.map((hotel, index) => <div className="workspace-pin workspace-hotel-pin" style={positions[(index + places.length + 2) % positions.length]} key={`hotel-${hotel.id}`}><button className="workspace-pin-button" aria-label={`Hotel: ${hotel.name}`} type="button">H</button><MapHotelPreview hotel={hotel} /></div>)}
      <div className="map-demo-label">Map preview · {destination || "Add a Mapbox key for live tiles"}</div>
      {unplannedCount || transitCount ? <MapLegend transitCount={transitCount} unplannedCount={unplannedCount} /> : null}
      <div className="map-controls"><button type="button" aria-label="Zoom in"><Plus size={17} /></button><button type="button" aria-label="Zoom out"><Minus size={17} /></button><button type="button" aria-label="Find me"><LocateFixed size={17} /></button></div>
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
