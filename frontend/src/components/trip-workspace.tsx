"use client";

import {
  ArrowRight,
  BedDouble,
  Bike,
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
  ChevronUp,
  Coffee,
  FileText,
  ExternalLink,
  Footprints,
  Landmark,
  List,
  Map as MapIcon,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Plane,
  Route,
  Search,
  Share2,
  ShoppingBag,
  Trash2,
  TramFront,
  Utensils,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveTransitPlan as persistSaveTransitPlan,
  removeTransitPlan as persistRemoveTransitPlan,
  addDayNote as persistAddDayNote,
  addFlight as persistAddFlight,
  addHotelStay as persistAddHotelStay,
  addPlace as persistPlace,
  addTripCity as persistAddTripCity,
  reorderDayPlaces as persistReorderDayPlaces,
  removeDayNote as persistRemoveDayNote,
  removeFlight as persistRemoveFlight,
  removeHotelStay as persistRemoveHotelStay,
  removePlace as persistRemovePlace,
  removeTripCity as persistRemoveTripCity,
  updateDayNote as persistUpdateDayNote,
  updateFlight as persistUpdateFlight,
  updateHotelStay as persistUpdateHotelStay,
  updatePlace as persistUpdatePlace,
  updatePlaceDetails as persistUpdatePlaceDetails,
} from "@/app/trips/actions";
import { AddPlaceDialog } from "@/components/add-place-dialog";
import { AgendaPanel } from "@/components/agenda-panel";
import { TransitEditor, TransitRideCard, transitLegs, type TransitDraft } from "@/components/day-transit-planner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CityField } from "@/components/city-field";
import { EditPlaceDialog, type PlaceEditDraft } from "@/components/edit-place-dialog";
import { FlightPlanDialog, type FlightDraft } from "@/components/flight-plan-dialog";
import { HotelStayDialog, type HotelStayDraft } from "@/components/hotel-stay-dialog";
import { InviteDialog } from "@/components/invite-dialog";
import { PlacePhoto } from "@/components/place-photo";
import { TripLogisticsDialog, type TripDetails } from "@/components/trip-logistics-dialog";
import { TripMap } from "@/components/trip-map";
import { countryFromDestination } from "@/lib/dates";
import { buildAppleMapsUrl, buildGoogleMapsPlaceUrl, buildGoogleMapsUrl } from "@/lib/navigation";
import { PLACE_CATEGORIES, categoryClass, isPersistedTripId, type CityStop, type DayNote, type Flight, type HotelStay, type Place, type PlaceCategory, type RouteStop, type TravelMode, type TransitPlan, type Trip, type TripViewer } from "@/lib/types";

type RouteStats = { durationSeconds: number; distanceMeters: number };
type MobileView = "list" | "map";
type SaveState = "idle" | "saving" | "saved" | "error";
type WorkspaceMode = "saved" | "day" | "agenda";

const categoryIcons = {
  Eat: Utensils,
  Drink: Coffee,
  See: Landmark,
  Shop: ShoppingBag,
  Stay: BedDouble,
  Transit: TramFront,
  Other: MapPin,
} satisfies Record<PlaceCategory, typeof MapPin>;

function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function addIsoDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function tripDates(startDate: string, endDate: string) {
  if (!startDate || !endDate) return [];
  const dates: string[] = [];
  for (let date = startDate; date <= endDate && dates.length < 45; date = addIsoDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function formatDayHeading(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return {
    day: date.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" }),
    date: date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }),
  };
}

function placeMatchesQuery(place: Place, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [place.name, place.address, place.neighborhood, place.note, place.category, place.addedBy]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

function parseCityStop(destination: string, trip: TripDetails): Omit<CityStop, "id" | "sortOrder"> {
  const parts = destination.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    name: parts[0] || destination.trim(),
    country: parts.length > 1 ? parts.at(-1) ?? "" : countryFromDestination(destination),
    startDate: trip.startDate,
    endDate: trip.endDate,
  };
}

export function TripWorkspace({
  trip,
  mapToken,
  viewer,
}: {
  trip: Trip;
  mapToken?: string;
  viewer?: TripViewer;
}) {
  const router = useRouter();
  const [places, setPlaces] = useState(trip.places);
  const [cities, setCities] = useState(trip.cities);
  const [dayNotes, setDayNotes] = useState(trip.dayNotes);
  const [flights, setFlights] = useState(trip.flights);
  const [hotels, setHotels] = useState(trip.hotels);
  const [transitPlans, setTransitPlans] = useState(trip.transitPlans ?? []);
  const [details, setDetails] = useState<TripDetails>({
    title: trip.title,
    destination: trip.destination,
    country: trip.country,
    dateLabel: trip.dateLabel,
    startDate: trip.startDate,
    endDate: trip.endDate,
  });
  const [selectedId, setSelectedId] = useState(trip.places[0]?.id ?? "");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(trip.startDate ? "day" : "saved");
  const [activeCityId, setActiveCityId] = useState<string>("all");
  const [activeDate, setActiveDate] = useState<string | null>(trip.startDate || null);
  const [filter, setFilter] = useState<PlaceCategory | "All">("All");
  const [placeQuery, setPlaceQuery] = useState("");
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [addOpen, setAddOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [newCityForPlace, setNewCityForPlace] = useState(false);
  const [newestCityId, setNewestCityId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [logisticsOpen, setLogisticsOpen] = useState(false);
  const [placeEditor, setPlaceEditor] = useState<Place | null>(null);
  const [flightEditor, setFlightEditor] = useState<Flight | "new" | null>(null);
  const [hotelEditor, setHotelEditor] = useState<HotelStay | "new" | null>(null);
  const [routeMode, setRouteMode] = useState<TravelMode | null>(null);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveNotice, setSaveNotice] = useState("");
  const navDialogRef = useRef<HTMLElement>(null);
  const persistChain = useRef(Promise.resolve());
  const persistedIds = useRef(new Map<string, string>());
  const persistedCityIds = useRef(new Map<string, string>());
  const localCityCounter = useRef(0);
  const localNoteCounter = useRef(0);
  const localFlightCounter = useRef(0);
  const localHotelCounter = useRef(0);
  const persistable = isPersistedTripId(trip.id);
  // Deleting is owner-only. The server enforces it; this keeps editors from
  // seeing a button that would only ever fail for them.
  const viewerIsOwner = trip.collaborators.some(
    (person) => person.id === viewer?.id && person.role === "owner",
  );
  const primaryCity = cities[0];
  const selectedCity = activeCityId === "all" ? primaryCity : cities.find((city) => city.id === activeCityId) ?? primaryCity;
  const cityScopedPlaces = useMemo(
    () => (activeCityId === "all" ? places : places.filter((place) => place.cityId === activeCityId)),
    [activeCityId, places],
  );

  function enqueuePersist(work: () => Promise<void>) {
    setSaveNotice("");
    setSaveState("saving");
    persistChain.current = persistChain.current
      .then(work)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }

  const itineraryDates = useMemo(() => tripDates(details.startDate, details.endDate), [details.startDate, details.endDate]);
  const planDates = useMemo(
    () => Array.from(new Set([...itineraryDates, ...flights.flatMap((flight) => [flight.plannedDate, flight.arrivalDate]), ...hotels.flatMap((hotel) => [hotel.startDate, hotel.endDate])])).sort(),
    [flights, hotels, itineraryDates],
  );
  const visiblePlaces = useMemo(
    () => cityScopedPlaces.filter((place) =>
      (filter === "All" || place.category === filter) && placeMatchesQuery(place, placeQuery),
    ),
    [cityScopedPlaces, filter, placeQuery],
  );
  const activeHotel = useMemo(() => workspaceMode === "day" && activeDate
    ? hotels.find((hotel) => hotel.startDate <= activeDate && hotel.endDate >= activeDate && (activeCityId === "all" || !hotel.cityId || hotel.cityId === activeCityId)) ?? null
    : null, [activeCityId, activeDate, hotels, workspaceMode]);
  const mapHotels = useMemo(() => workspaceMode === "day" ? (activeHotel ? [activeHotel] : []) : hotels.filter((hotel) => activeCityId === "all" || !hotel.cityId || hotel.cityId === activeCityId), [activeCityId, activeHotel, hotels, workspaceMode]);
  const mapPlaces = useMemo(() => {
    const scoped = cityScopedPlaces.filter((place) => placeMatchesQuery(place, placeQuery));
    if (workspaceMode === "day" && placeQuery.trim()) return scoped;
    if (workspaceMode === "day" && activeDate) {
      return scoped
        .filter((place) => place.plannedDate === activeDate)
        .toSorted((left, right) => (left.daySortOrder ?? 0) - (right.daySortOrder ?? 0));
    }
    return scoped;
  }, [activeDate, cityScopedPlaces, placeQuery, workspaceMode]);
  const routeStops = useMemo<RouteStop[]>(() => activeHotel ? [{ id: `hotel-${activeHotel.id}`, name: activeHotel.name, coordinates: activeHotel.coordinates }, ...mapPlaces.map((place) => ({ id: place.id, name: place.name, coordinates: place.coordinates }))] : mapPlaces.map((place) => ({ id: place.id, name: place.name, coordinates: place.coordinates })), [activeHotel, mapPlaces]);
  const routeCoordinates = useMemo(() => routeStops.map((stop) => stop.coordinates), [routeStops]);
  const routeAvailable = routeStops.length >= 2;

  const selectPlace = useCallback((id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(min-width: 1100px)").matches) {
      requestAnimationFrame(() => document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }, []);

  useEffect(() => {
    if (!routeMode || routeStops.length < 2) {
      return;
    }
    const controller = new AbortController();
    fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: routeStops.map((stop) => stop.coordinates), mode: routeMode }),
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Route unavailable")))
      .then((body: RouteStats) => setRouteStats(body))
      .catch(() => setRouteStats(null));
    return () => controller.abort();
  }, [routeMode, routeStops]);

  useEffect(() => {
    if (saveState !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  useEffect(() => {
    if (!navOpen) return;
    navDialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navOpen]);

  function addPlace(place: Place, requestedCityId?: string) {
    const cityId = requestedCityId || selectedCity?.id || null;
    const plannedDate = place.plannedDate ?? null;
    const alreadyOnDay = places.some((item) => item.fsqPlaceId === place.fsqPlaceId && (item.plannedDate ?? null) === plannedDate);
    if (alreadyOnDay) {
      setSaveState("error");
      setSaveNotice(plannedDate ? "That place is already on this day." : "That place is already saved without a day.");
      return;
    }
    const daySortOrder = plannedDate
      ? places.filter((item) => item.plannedDate === plannedDate && item.cityId === cityId).length
      : 0;
    const next = { ...place, cityId, plannedDate, daySortOrder, addedBy: viewer?.name || place.addedBy, saved: true };
    setPlaces((current) => [...current, next]);
    setSelectedId(next.id);
    setFilter("All");
    setMobileView("list");
    if (!persistable) return;
    enqueuePersist(async () => {
      try {
        const saved = await persistPlace({
          tripId: trip.id,
          cityId: isUuid(cityId) ? cityId : persistedCityIds.current.get(cityId ?? "") ?? "",
          fsqPlaceId: next.fsqPlaceId,
          name: next.name,
          address: next.address,
          neighborhood: next.neighborhood,
          longitude: next.coordinates[0],
          latitude: next.coordinates[1],
          category: next.category,
          note: next.note,
          sourceUrl: next.sourceUrl ?? "",
          saved: true,
          plannedDate: next.plannedDate ?? "",
          daySortOrder: next.daySortOrder ?? 0,
        });
        if (!("id" in saved) || !saved.id) return;
        persistedIds.current.set(next.id, saved.id);
        setPlaces((current) => current.map((item) => (item.id === next.id ? { ...item, id: saved.id } : item)));
        setSelectedId((current) => (current === next.id ? saved.id : current));
      } catch (error) {
        setPlaces((current) => current.filter((item) => item.id !== next.id));
        if (error instanceof Error && error.message) setSaveNotice(error.message);
        throw error;
      }
    });
  }

  function savePlaceEdit(id: string, draft: PlaceEditDraft) {
    const previous = places.find((item) => item.id === id);
    if (!previous) return;
    const plannedDate = draft.plannedDate ?? null;
    const cityId = draft.cityId ?? null;
    const alreadyOnDay = places.some((item) => item.id !== id && item.fsqPlaceId === previous.fsqPlaceId && (item.plannedDate ?? null) === plannedDate);
    if (alreadyOnDay) {
      setSaveState("error");
      setSaveNotice(plannedDate ? "That place is already on this day." : "That place is already saved without a day.");
      return;
    }
    const daySortOrder = plannedDate
      ? plannedDate === previous.plannedDate
        ? previous.daySortOrder ?? 0
        : places.filter((place) => place.plannedDate === plannedDate && place.id !== id && (!cityId || place.cityId === cityId)).length
      : 0;
    const next: Place = {
      ...previous,
      ...draft,
      sourceUrl: draft.sourceUrl || undefined,
      cityId,
      plannedDate,
      daySortOrder,
    };
    setPlaces((current) => current.map((item) => (item.id === id ? next : item)));
    setSelectedId(id);
    if (!persistable) return;
    enqueuePersist(async () => {
      try {
        const placeId = persistedIds.current.get(id) ?? id;
        if (placeId.startsWith("local-")) return;
        await persistUpdatePlaceDetails({
          tripId: trip.id,
          placeId,
          cityId: isUuid(cityId) ? cityId : persistedCityIds.current.get(cityId ?? "") ?? "",
          name: next.name,
          address: next.address,
          neighborhood: next.neighborhood,
          category: next.category,
          note: next.note,
          sourceUrl: next.sourceUrl ?? "",
          plannedDate: next.plannedDate ?? "",
          daySortOrder,
        });
      } catch (error) {
        setPlaces((current) => current.map((item) => (item.id === id ? previous : item)));
        if (error instanceof Error && error.message) setSaveNotice(error.message);
        throw error;
      }
    });
  }

  function reorderDay(plannedDate: string, placeIds: string[]) {
    const previous = places;
    const order = new Map(placeIds.map((id, index) => [id, index]));
    setPlaces((current) => current.map((place) => (
      place.plannedDate === plannedDate && order.has(place.id)
        ? { ...place, daySortOrder: order.get(place.id) ?? place.daySortOrder }
        : place
    )));
    if (!persistable) return;
    enqueuePersist(async () => {
      try {
        await persistReorderDayPlaces({ tripId: trip.id, plannedDate, placeIds });
      } catch (error) {
        setPlaces(previous);
        throw error;
      }
    });
  }

  function toggleSaved(id: string) {
    const place = places.find((item) => item.id === id);
    const nextSaved = !place?.saved;
    setPlaces((current) => current.map((item) => (item.id === id ? { ...item, saved: !item.saved } : item)));
    if (!persistable || !place) return;
    enqueuePersist(async () => {
      try {
        const placeId = persistedIds.current.get(id) ?? id;
        if (placeId.startsWith("local-")) return;
        await persistUpdatePlace({ tripId: trip.id, placeId, saved: nextSaved });
      } catch (error) {
        setPlaces((current) => current.map((item) => (item.id === id ? { ...item, saved: place.saved } : item)));
        throw error;
      }
    });
  }

  function removePlace(id: string) {
    const removed = places.find((place) => place.id === id);
    setPlaces((current) => {
      const next = current.filter((place) => place.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? "");
      return next;
    });
    if (!persistable) return;
    enqueuePersist(async () => {
      try {
        const placeId = persistedIds.current.get(id) ?? id;
        if (placeId.startsWith("local-")) return;
        await persistRemovePlace({ tripId: trip.id, placeId });
      } catch (error) {
        if (removed) setPlaces((current) => (current.some((place) => place.id === removed.id) ? current : [...current, removed]));
        throw error;
      }
    });
  }

  function addCity(city: Omit<CityStop, "id" | "sortOrder">): CityStop {
    localCityCounter.current += 1;
    const localId = `local-city-${localCityCounter.current}`;
    const next = { ...city, id: localId, sortOrder: cities.length };
    setCities((current) => [...current, next]);
    setActiveCityId(localId);
    if (!persistable) return next;
    enqueuePersist(async () => {
      try {
        const saved = await persistAddTripCity({
          tripId: trip.id,
          name: next.name,
          country: next.country,
          startDate: next.startDate ?? "",
          endDate: next.endDate ?? "",
        });
        if (!("id" in saved) || !saved.id) return;
        persistedCityIds.current.set(localId, saved.id);
        setCities((current) => current.map((cityItem) => (cityItem.id === localId ? { ...cityItem, id: saved.id } : cityItem)));
        setPlaces((current) => current.map((place) => (place.cityId === localId ? { ...place, cityId: saved.id } : place)));
        setDayNotes((current) => current.map((note) => (note.cityId === localId ? { ...note, cityId: saved.id } : note)));
        setActiveCityId((current) => (current === localId ? saved.id : current));
      } catch (error) {
        setCities((current) => current.filter((cityItem) => cityItem.id !== localId));
        setActiveCityId("all");
        throw error;
      }
    });
    return next;
  }

  function removeCity(cityId: string) {
    const removed = cities.find((city) => city.id === cityId);
    if (!removed || cities.length <= 1) return;
    const previousPlaces = places;
    const previousNotes = dayNotes;
    setCities((current) => current.filter((city) => city.id !== cityId));
    setPlaces((current) => current.map((place) => (place.cityId === cityId ? { ...place, cityId: null, plannedDate: null, daySortOrder: 0 } : place)));
    setDayNotes((current) => current.map((note) => (note.cityId === cityId ? { ...note, cityId: null } : note)));
    setActiveCityId("all");
    if (!persistable || !isUuid(cityId)) return;
    enqueuePersist(async () => {
      try {
        await persistRemoveTripCity({ tripId: trip.id, cityId });
      } catch (error) {
        setCities((current) => [...current, removed].sort((left, right) => left.sortOrder - right.sortOrder));
        setPlaces(previousPlaces);
        setDayNotes(previousNotes);
        throw error;
      }
    });
  }

  function addNote(plannedDate: string, note: string, cityId: string) {
    localNoteCounter.current += 1;
    const localId = `local-note-${localNoteCounter.current}`;
    const next: DayNote = {
      id: localId,
      cityId: cityId === "all" ? null : cityId,
      plannedDate,
      note,
      sortOrder: dayNotes.filter((item) => item.plannedDate === plannedDate).length,
      addedBy: viewer?.name || "Traveller",
    };
    setDayNotes((current) => [...current, next]);
    if (!persistable) return;
    enqueuePersist(async () => {
      try {
        const saved = await persistAddDayNote({
          tripId: trip.id,
          cityId: isUuid(next.cityId) ? next.cityId : "",
          plannedDate,
          note,
        });
        if (!("id" in saved) || !saved.id) return;
        setDayNotes((current) => current.map((item) => (item.id === localId ? { ...item, id: saved.id } : item)));
      } catch (error) {
        setDayNotes((current) => current.filter((item) => item.id !== localId));
        throw error;
      }
    });
  }

  function updateNote(noteId: string, note: string) {
    const previous = dayNotes.find((item) => item.id === noteId);
    if (!previous) return;
    const next = { ...previous, note };
    setDayNotes((current) => current.map((item) => (item.id === noteId ? next : item)));
    if (!persistable || noteId.startsWith("local-")) return;
    enqueuePersist(async () => {
      try {
        await persistUpdateDayNote({
          tripId: trip.id,
          noteId,
          cityId: isUuid(next.cityId) ? next.cityId : "",
          plannedDate: next.plannedDate,
          note: next.note,
        });
      } catch (error) {
        setDayNotes((current) => current.map((item) => (item.id === noteId ? previous : item)));
        throw error;
      }
    });
  }

  function removeNote(noteId: string) {
    const previous = dayNotes.find((item) => item.id === noteId);
    setDayNotes((current) => current.filter((item) => item.id !== noteId));
    if (!persistable || noteId.startsWith("local-")) return;
    enqueuePersist(async () => {
      try {
        await persistRemoveDayNote({ tripId: trip.id, noteId });
      } catch (error) {
        if (previous) setDayNotes((current) => [...current, previous]);
        throw error;
      }
    });
  }

  function saveFlight(draft: FlightDraft) {
    const existing = flightEditor !== "new" ? flightEditor : null;
    const previous = flights;
    if (existing) {
      const next = { ...existing, ...draft };
      setFlights((current) => current.map((flight) => flight.id === existing.id ? next : flight));
      if (!persistable || existing.id.startsWith("local-")) return;
      enqueuePersist(async () => {
        try {
          await persistUpdateFlight({ tripId: trip.id, flightId: existing.id, ...draft });
        } catch (error) {
          setFlights(previous);
          throw error;
        }
      });
      return;
    }
    localFlightCounter.current += 1;
    const next: Flight = { id: `local-flight-${localFlightCounter.current}`, ...draft };
    setFlights((current) => [...current, next]);
    if (!persistable) return;
    enqueuePersist(async () => {
      try {
        const saved = await persistAddFlight({ tripId: trip.id, ...draft });
        if (!("id" in saved) || !saved.id) return;
        setFlights((current) => current.map((flight) => flight.id === next.id ? { ...flight, id: saved.id } : flight));
      } catch (error) {
        setFlights((current) => current.filter((flight) => flight.id !== next.id));
        throw error;
      }
    });
  }

  function removeFlight(id: string) {
    const previous = flights;
    setFlights((current) => current.filter((flight) => flight.id !== id));
    if (!persistable || id.startsWith("local-")) return;
    enqueuePersist(async () => {
      try {
        await persistRemoveFlight({ tripId: trip.id, flightId: id });
      } catch (error) {
        setFlights(previous);
        throw error;
      }
    });
  }

  function saveHotel(draft: HotelStayDraft) {
    const existing = hotelEditor !== "new" ? hotelEditor : null;
    const previous = hotels;
    if (existing) {
      const next = { ...existing, ...draft };
      setHotels((current) => current.map((hotel) => hotel.id === existing.id ? next : hotel));
      if (!persistable || existing.id.startsWith("local-")) return;
      enqueuePersist(async () => {
        try {
          await persistUpdateHotelStay({ tripId: trip.id, hotelId: existing.id, cityId: isUuid(draft.cityId) ? draft.cityId : "", name: draft.name, address: draft.address, longitude: draft.coordinates[0], latitude: draft.coordinates[1], startDate: draft.startDate, endDate: draft.endDate });
        } catch (error) { setHotels(previous); throw error; }
      });
      return;
    }
    localHotelCounter.current += 1;
    const next: HotelStay = { id: `local-hotel-${localHotelCounter.current}`, ...draft };
    setHotels((current) => [...current, next]);
    if (!persistable) return;
    enqueuePersist(async () => {
      try {
        const saved = await persistAddHotelStay({ tripId: trip.id, cityId: isUuid(draft.cityId) ? draft.cityId : "", name: draft.name, address: draft.address, longitude: draft.coordinates[0], latitude: draft.coordinates[1], startDate: draft.startDate, endDate: draft.endDate });
        if (!("id" in saved) || !saved.id) return;
        setHotels((current) => current.map((hotel) => hotel.id === next.id ? { ...hotel, id: saved.id } : hotel));
      } catch (error) { setHotels((current) => current.filter((hotel) => hotel.id !== next.id)); throw error; }
    });
  }

  function removeHotel(id: string) {
    const previous = hotels;
    setHotels((current) => current.filter((hotel) => hotel.id !== id));
    if (!persistable || id.startsWith("local-")) return;
    enqueuePersist(async () => {
      try { await persistRemoveHotelStay({ tripId: trip.id, hotelId: id }); }
      catch (error) { setHotels(previous); throw error; }
    });
  }

  async function saveTransit(draft: TransitDraft) {
    setSaveState("saving");
    try {
      const saved = persistable ? await persistSaveTransitPlan({ ...draft, tripId: trip.id }) : { id: draft.id ?? `local-transit-${crypto.randomUUID()}` };
      const next = { ...draft, id: saved.id };
      setTransitPlans((current) => draft.id ? current.map((plan) => plan.id === draft.id ? next : plan) : [...current, next]);
      setSaveState("saved");
    } catch (error) { setSaveState("error"); throw error; }
  }

  async function removeTransit(id: string) {
    setSaveState("saving");
    try {
      if (persistable) await persistRemoveTransitPlan({ tripId: trip.id, id });
      setTransitPlans((current) => current.filter((plan) => plan.id !== id));
      setSaveState("saved");
    } catch (error) { setSaveState("error"); throw error; }
  }

  const selected = mapPlaces.find((place) => place.id === selectedId) ?? mapPlaces[0];
  const activeRouteStats = routeMode && routeStops.length >= 2 ? routeStats : null;
  const minutes = activeRouteStats ? Math.max(1, Math.round(activeRouteStats.durationSeconds / 60)) : null;
  const kilometers = activeRouteStats ? (activeRouteStats.distanceMeters / 1000).toFixed(1) : null;
  const selectedMapLabel = selected?.category === "Transit"
    ? "TR"
    : String(mapPlaces.findIndex((place) => place.id === selected?.id) + 1).padStart(2, "0");

  return (
    <div className={`trip-workspace mobile-${mobileView}`}>
      <div className="mobile-view-switch" role="tablist" aria-label="Trip view">
        <button role="tab" aria-selected={mobileView === "list"} className={mobileView === "list" ? "active" : ""} onClick={() => setMobileView("list")} type="button"><List size={15} /> List</button>
        <button role="tab" aria-selected={mobileView === "map"} className={mobileView === "map" ? "active" : ""} onClick={() => setMobileView("map")} type="button"><MapIcon size={15} /> Map</button>
      </div>

      <div className="places-panel-logistics">
        <div className="mobile-trip-context">
          <label><span className="sr-only">City stops</span><select value={activeCityId} onChange={(event) => setActiveCityId(event.target.value)}><option value="all">All stops</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
          <span className={`save-status${saveState === "error" ? " error" : ""}`} role="status">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? (saveNotice || "Couldn’t save") : details.dateLabel}</span>
          <DropdownMenu><DropdownMenuTrigger asChild><button className="place-menu-trigger" aria-label="Trip options" type="button"><MoreHorizontal size={20} /></button></DropdownMenuTrigger>
            <DropdownMenuContent className="planner-menu" align="end">
              <DropdownMenuItem onSelect={() => setLogisticsOpen(true)}><Pencil size={16} /> Trip details</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInviteOpen(true)}><Share2 size={16} /> Invite people</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setNewCityForPlace(false); setCityOpen(true); }}><Plus size={16} /> Add city stop</DropdownMenuItem>
              {activeCityId !== "all" && cities.length > 1 ? <DropdownMenuItem variant="destructive" onSelect={() => removeCity(activeCityId)}><Trash2 size={16} /> Remove this city</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="city-strip" aria-label="City stops">
          <button className={activeCityId === "all" ? "active" : ""} onClick={() => setActiveCityId("all")} type="button">All stops</button>
          {cities.map((city) => (
            <span className={`city-chip${activeCityId === city.id ? " active" : ""}`} key={city.id}>
              <button onClick={() => setActiveCityId(city.id)} type="button">{city.name}</button>
              {cities.length > 1 ? <button aria-label={`Remove ${city.name}`} onClick={() => removeCity(city.id)} type="button"><X size={12} /></button> : null}
            </span>
          ))}
          <button className="city-add" onClick={() => { setNewCityForPlace(false); setCityOpen(true); }} type="button"><Plus size={13} /> Stop</button>
        </div>
        <div className="places-panel-logistics-row">
          <button className="places-panel-logistics-where" onClick={() => setLogisticsOpen(true)} type="button">
            {details.destination} · {details.dateLabel}
          </button>
          {saveState !== "idle" ? (
            <span className={`save-status${saveState === "error" ? " error" : ""}`} aria-live="polite">
              {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : (saveNotice || "Couldn’t save")}
            </span>
          ) : null}
          <button onClick={() => setInviteOpen(true)} type="button"><Share2 size={14} /> Invite</button>
        </div>
      </div>

      <aside className="places-panel">
        <div className="places-panel-header">
          <h1 className="sr-only">{details.title}</h1>
          <div className="places-panel-toolbar">
            <div className="workspace-mode" role="tablist" aria-label="Planning mode">
              <button role="tab" aria-selected={workspaceMode === "saved"} className={workspaceMode === "saved" ? "active" : ""} onClick={() => { setWorkspaceMode("saved"); }} type="button"><Bookmark size={14} /> Saved places</button>
              <button role="tab" aria-selected={workspaceMode === "day"} className={workspaceMode === "day" ? "active" : ""} onClick={() => { setWorkspaceMode("day"); setActiveDate((current) => current ?? planDates[0] ?? null); }} type="button"><CalendarDays size={14} /> Day plan</button>
              <button role="tab" aria-selected={workspaceMode === "agenda"} className={workspaceMode === "agenda" ? "active" : ""} onClick={() => setWorkspaceMode("agenda")} type="button"><FileText size={14} /> Agenda</button>
            </div>
            <div className="trip-header-actions">
              <button className="icon-button trip-options" aria-label="Add a place" onClick={() => setAddOpen(true)} type="button"><Plus size={19} /></button>
            </div>
          </div>
          {workspaceMode !== "agenda" ? (
            <>
            <details className="mobile-find">
              <summary><Search size={15} />{placeQuery || filter !== "All" ? "Search & filters active" : "Search & filter"}<SlidersHorizontal size={15} /></summary>
              <div>
                <input aria-label="Search places on mobile" value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Search places" type="search" />
                <select aria-label="Place category" value={filter} onChange={(event) => setFilter(event.target.value as PlaceCategory | "All")}><option value="All">All categories</option>{PLACE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
              </div>
            </details>
            <div className="places-panel-find">
              <div className="filter-scroll" aria-label="Filter places">
                <button className={`filter-pill filter-all${filter === "All" ? " active" : ""}`} onClick={() => setFilter("All")} type="button">All</button>
                {PLACE_CATEGORIES.map((item) => {
                  const Icon = categoryIcons[item];
                  return <button className={`filter-pill ${categoryClass(item)}${filter === item ? " active" : ""}`} onClick={() => setFilter(item)} key={item} type="button"><Icon size={13} /> {item}</button>;
                })}
              </div>
              <div className="place-find">
                <Search size={14} aria-hidden="true" />
                <input
                  aria-label="Search places"
                  onChange={(event) => setPlaceQuery(event.target.value)}
                  placeholder="Search places"
                  value={placeQuery}
                />
                {placeQuery ? (
                  <button aria-label="Clear search" onClick={() => setPlaceQuery("")} type="button"><X size={12} /></button>
                ) : null}
              </div>
            </div>
            </>
          ) : null}
        </div>

        <div className="place-list">
          {workspaceMode === "saved" ? visiblePlaces.map((place) => {
            const originalIndex = places.findIndex((item) => item.id === place.id);
            const number = String(originalIndex + 1).padStart(2, "0");
            return (
              <article
                className={`saved-place${selectedId === place.id ? " selected" : ""}`}
                id={`place-${place.id}`}
                onClick={() => selectPlace(place.id)}
                onKeyDown={(event) => {
                  if (event.currentTarget !== event.target) return;
                  if (event.key === "Enter" || event.key === " ") selectPlace(place.id);
                }}
                tabIndex={0}
                aria-label={`Show ${place.name} on the map`}
                key={place.id}
              >
                <div className="itinerary-rail"><span>{number}</span><i /></div>
                <PlacePhoto fsqPlaceId={place.fsqPlaceId} name={place.name} label={place.category} />
                <div className="saved-place-copy">
                  <p className="place-kicker">
                    <span className={`category-tag ${categoryClass(place.category)}`}>{place.category}</span>
                    {place.neighborhood ? <span className="place-hood">{place.neighborhood}</span> : null}
                  </p>
                  <h2>{place.name}</h2>
                  <small className="place-address">
                    {place.address}
                    <a
                      href={buildGoogleMapsPlaceUrl(place)}
                      aria-label={`Open ${place.name} in Google Maps`}
                      onClick={(event) => event.stopPropagation()}
                      rel="noreferrer"
                      target="_blank"
                    >
                      🗺️
                    </a>
                  </small>
                  {place.note ? <p className="place-note">{place.note}</p> : null}
                  <button className="place-plan-link" onClick={(event) => { event.stopPropagation(); setPlaceEditor(place); }} type="button"><CalendarDays size={13} /> {place.plannedDate ? formatDayHeading(place.plannedDate).date : "Add to a day"}</button>
                  <div className="place-actions">
                    <span className="contributor">Added by {place.addedBy}</span>
                    {place.sourceUrl ? <a href={place.sourceUrl} onClick={(event) => event.stopPropagation()} target="_blank" rel="noreferrer">Original source <ExternalLink size={13} /></a> : null}
                  </div>
                </div>
                <PlaceActions place={place} onEdit={() => setPlaceEditor(place)} onToggleSaved={() => toggleSaved(place.id)} onRemove={() => removePlace(place.id)} />
              </article>
            );
          }) : workspaceMode === "day" ? (
            <DayPlan
              activeCityId={activeCityId}
              activeDate={activeDate}
              cities={cities}
              dates={planDates}
              dayNotes={dayNotes}
              flights={flights}
              hotels={hotels}
              transitPlans={transitPlans}
              onSaveTransit={saveTransit}
              onRemoveTransit={removeTransit}
              filter={filter}
              query={placeQuery}
              onAddNote={addNote}
              onFocusDate={setActiveDate}
              onAddFlight={() => setFlightEditor("new")}
              onEditFlight={(flight) => setFlightEditor(flight)}
              onAddHotel={() => setHotelEditor("new")}
              onEditHotel={(hotel) => setHotelEditor(hotel)}
              onEditPlace={(place) => setPlaceEditor(place)}
              onRemoveNote={removeNote}
              onRemovePlace={removePlace}
              onSelectPlace={selectPlace}
              onReorderDay={reorderDay}
              onToggleSaved={toggleSaved}
              onUpdateNote={updateNote}
              places={places}
              selectedId={selectedId}
            />
          ) : (
            <AgendaPanel
              agenda={trip.agenda}
              onSaveState={setSaveState}
              persistable={persistable}
              tripId={trip.id}
            />
          )}
          {workspaceMode === "saved" && !visiblePlaces.length ? (
            <div className="empty-filter">
              <p>{placeQuery.trim() ? `No places match “${placeQuery.trim()}”.` : `No ${filter.toLowerCase()} places yet.`}</p>
              {placeQuery.trim() ? null : <button onClick={() => setAddOpen(true)} type="button">Add the first one <Plus size={15} /></button>}
            </div>
          ) : null}
          {workspaceMode === "saved" ? <button className="add-place-row" onClick={() => setAddOpen(true)} type="button"><span><Plus size={18} /></span><div><strong>Add another place</strong><small>Search {selectedCity?.name ?? details.destination}</small></div></button> : null}
        </div>
      </aside>

      <section className="map-panel">
        <TripMap destination={selectedCity?.name ?? details.destination} hotels={mapHotels} places={mapPlaces} routeCoordinates={routeCoordinates} selectedId={selectedId} onSelect={selectPlace} routeActive={Boolean(routeMode) && routeStops.length >= 2} mapToken={mapToken} />
        <div className="map-topbar">
          <button className={`route-button${routeMode ? " active" : ""}`} disabled={!routeAvailable} onClick={() => setRouteMode((current) => current ?? "walking")} type="button"><Route size={16} /> {routeMode ? "Route active" : "Plan a route"}</button>
        </div>
        {selected ? <button className={`mobile-place-peek${selected.category === "Transit" ? " transit" : ""}`} onClick={() => setMobileView("list")} type="button"><span>{selectedMapLabel}</span><strong>{selected.name}</strong><small>{selected.neighborhood} · View details</small></button> : null}
        {routeMode && routeAvailable ? (
          <div className="route-dock">
            <header><div><p className="eyebrow">Route preview</p><strong>{routeStops.length} stops · {kilometers ?? "…"} km</strong></div><button className="icon-button" onClick={() => setRouteMode(null)} aria-label="Close route preview" type="button"><X size={18} /></button></header>
            <div className="mode-picker">
              {(["walking", "cycling", "driving"] as TravelMode[]).map((mode) => (
                <button className={routeMode === mode ? "active" : ""} onClick={() => setRouteMode(mode)} key={mode} type="button">
                  {mode === "walking" ? <Footprints size={15} /> : mode === "cycling" ? <Bike size={15} /> : <Navigation size={15} />}<span>{mode}</span>
                </button>
              ))}
            </div>
            <div className="route-summary"><div><strong>{minutes ?? "—"}</strong><small>min</small></div><p>A planning preview. Your navigation app handles live directions.</p><button className="button button-ink" onClick={() => setNavOpen(true)} type="button"><Navigation size={16} /> Start</button></div>
          </div>
        ) : null}
      </section>

      <button className="mobile-add-button" onClick={() => setAddOpen(true)} aria-label="Add a place" type="button"><Plus size={22} /></button>
      {addOpen ? (
        <AddPlaceDialog
          cities={cities}
          dates={itineraryDates}
          destination={selectedCity?.name ?? details.destination}
          initialCityId={selectedCity?.id}
          initialPlannedDate={workspaceMode === "day" ? activeDate : null}
          newCityId={newestCityId}
          onAdd={addPlace}
          onAddCity={() => { setNewCityForPlace(true); setCityOpen(true); }}
          onCityChange={() => setNewestCityId(null)}
          onClose={() => { setAddOpen(false); setNewestCityId(null); }}
        />
      ) : null}
      {placeEditor ? <EditPlaceDialog cities={cities} dates={itineraryDates} onClose={() => setPlaceEditor(null)} onSave={savePlaceEdit} place={placeEditor} /> : null}
      {cityOpen ? <AddCityDialog details={details} onAdd={(city) => { const added = addCity(city); if (newCityForPlace) setNewestCityId(added.id); setNewCityForPlace(false); }} onClose={() => setCityOpen(false)} /> : null}
      {flightEditor ? (
        <FlightPlanDialog
          flight={flightEditor === "new" ? null : flightEditor}
          initialDate={activeDate ?? planDates[0] ?? ""}
          onClose={() => setFlightEditor(null)}
          onDelete={removeFlight}
          onSave={saveFlight}
        />
      ) : null}
      {hotelEditor ? <HotelStayDialog cities={cities} dates={planDates} destination={selectedCity?.name ?? details.destination} hotel={hotelEditor === "new" ? null : hotelEditor} initialDate={activeDate ?? planDates[0] ?? ""} onClose={() => setHotelEditor(null)} onDelete={removeHotel} onSave={saveHotel} /> : null}
      {inviteOpen ? <InviteDialog demo={!persistable} onClose={() => setInviteOpen(false)} tripId={trip.id} /> : null}
      {logisticsOpen ? (
        <TripLogisticsDialog
          canDelete={viewerIsOwner}
          onClose={() => setLogisticsOpen(false)}
          onSave={(next) => {
            setDetails(next);
            router.refresh();
          }}
          trip={{ ...details, id: trip.id }}
        />
      ) : null}
      {navOpen ? (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNavOpen(false)}>
          <section className="nav-dialog" ref={navDialogRef} role="dialog" aria-modal="true" aria-labelledby="nav-title" tabIndex={-1}>
            <button className="icon-button nav-close" onClick={() => setNavOpen(false)} aria-label="Close" type="button"><X size={19} /></button>
            <span className="nav-compass"><Navigation size={27} /></span>
            <p className="eyebrow">Hand off the route</p><h2 id="nav-title">Ready to go?</h2><p>Open the route in the navigation app you use on the road.</p>
            <a className="button button-ink button-full" href={buildGoogleMapsUrl(routeStops, routeMode ?? "walking")} target="_blank" rel="noreferrer">Open Google Maps <ExternalLink size={16} /></a>
            <a className="button button-ghost button-full" href={buildAppleMapsUrl(routeStops, routeMode ?? "walking")} target="_blank" rel="noreferrer">{activeHotel ? "Open Apple Maps to first stop" : "Open Apple Maps"} <ExternalLink size={16} /></a>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function DayPlan({
  transitPlans,
  onSaveTransit,
  onRemoveTransit,
  activeCityId,
  activeDate,
  cities,
  dates,
  dayNotes,
  flights,
  hotels,
  filter,
  query,
  onAddNote,
  onAddFlight,
  onEditFlight,
  onAddHotel,
  onEditHotel,
  onEditPlace,
  onFocusDate,
  onReorderDay,
  onRemoveNote,
  onRemovePlace,
  onSelectPlace,
  onToggleSaved,
  onUpdateNote,
  places,
  selectedId,
}: {
  transitPlans: TransitPlan[];
  onSaveTransit: (draft: TransitDraft) => Promise<void>;
  onRemoveTransit: (id: string) => Promise<void>;
  activeCityId: string;
  activeDate: string | null;
  cities: CityStop[];
  dates: string[];
  dayNotes: DayNote[];
  flights: Flight[];
  hotels: HotelStay[];
  filter: PlaceCategory | "All";
  query: string;
  onAddNote: (plannedDate: string, note: string, cityId: string) => void;
  onAddFlight: () => void;
  onEditFlight: (flight: Flight) => void;
  onAddHotel: () => void;
  onEditHotel: (hotel: HotelStay) => void;
  onEditPlace: (place: Place) => void;
  onFocusDate: (plannedDate: string | null) => void;
  onRemoveNote: (noteId: string) => void;
  onRemovePlace: (placeId: string) => void;
  onSelectPlace: (placeId: string) => void;
  onReorderDay: (plannedDate: string, placeIds: string[]) => void;
  onToggleSaved: (placeId: string) => void;
  onUpdateNote: (noteId: string, note: string) => void;
  places: Place[];
  selectedId: string;
}) {
  const cityMatches = (cityId?: string | null) => activeCityId === "all" || cityId === activeCityId;
  const categoryMatches = (category: PlaceCategory) => filter === "All" || category === filter;
  const visiblePlace = (place: Place) => cityMatches(place.cityId) && categoryMatches(place.category) && placeMatchesQuery(place, query);
  const unplannedPlaces = places.filter((place) => !place.plannedDate && visiblePlace(place));
  const plannedCount = places.filter((place) => place.plannedDate && visiblePlace(place)).length;
  const hasUnplannedPage = unplannedPlaces.length > 0;
  const totalPages = dates.length + (hasUnplannedPage ? 1 : 0);
  const pageIndex = activeDate ? Math.max(0, dates.indexOf(activeDate)) : hasUnplannedPage ? dates.length : 0;
  const clampedPageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1));
  const currentDate = clampedPageIndex < dates.length ? dates[clampedPageIndex] : null;
  const label = currentDate ? formatDayHeading(currentDate) : null;
  const notes = currentDate
    ? dayNotes
      .filter((note) => note.plannedDate === currentDate && cityMatches(note.cityId))
      .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];
  const dayFlights: { flight: Flight; moment: "departing" | "arriving" }[] = currentDate
    ? flights
      .flatMap((flight) => {
        if (flight.plannedDate === currentDate) return [{ flight, moment: "departing" as "departing" | "arriving" }];
        if (flight.arrivalDate === currentDate) return [{ flight, moment: "arriving" as "departing" | "arriving" }];
        return [];
      })
      .toSorted((left, right) => (left.moment === "departing" ? left.flight.departureTime : left.flight.arrivalTime).localeCompare(right.moment === "departing" ? right.flight.departureTime : right.flight.arrivalTime))
    : [];
  const dayHotel = currentDate
    ? hotels.find((hotel) => hotel.startDate <= currentDate && hotel.endDate >= currentDate && (activeCityId === "all" || !hotel.cityId || hotel.cityId === activeCityId))
    : null;
  const transitStops: RouteStop[] = [
    ...hotels.filter((hotel) => currentDate && hotel.startDate <= currentDate && hotel.endDate >= currentDate).map((hotel) => ({ id: `hotel-${hotel.id}`, name: hotel.name, coordinates: hotel.coordinates })),
    ...places
      .filter((place) => place.plannedDate === currentDate)
      .toSorted((left, right) => (left.daySortOrder ?? 0) - (right.daySortOrder ?? 0))
      .map((place) => ({ id: place.id, name: place.name, coordinates: place.coordinates })),
  ];
  const searching = Boolean(query.trim());
  const matchedPlaces = places
    .filter(visiblePlace)
    .sort((left, right) => {
      const dateCmp = (left.plannedDate ?? "zzz").localeCompare(right.plannedDate ?? "zzz");
      if (dateCmp !== 0) return dateCmp;
      return (left.daySortOrder ?? 0) - (right.daySortOrder ?? 0);
    });
  const dayPlaces = searching
    ? matchedPlaces
    : currentDate
      ? places
        .filter((place) => place.plannedDate === currentDate && visiblePlace(place))
        .sort((left, right) => (left.daySortOrder ?? 0) - (right.daySortOrder ?? 0))
      : unplannedPlaces;
  const canReorder = Boolean(!searching && currentDate && activeCityId === "all" && filter === "All" && dayPlaces.length > 1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [transitDraft, setTransitDraft] = useState<{ fromId: string; toId: string; plan: TransitPlan | null } | null>(null);
  const [removingTransitId, setRemovingTransitId] = useState<string | null>(null);
  const [transitError, setTransitError] = useState("");
  useEffect(() => { setTransitDraft(null); }, [currentDate]);

  function movePage(delta: number) {
    const nextIndex = Math.min(Math.max(clampedPageIndex + delta, 0), Math.max(0, totalPages - 1));
    onFocusDate(dates[nextIndex] ?? null);
  }

  function reorderPlace(placeId: string, targetIndex: number) {
    if (!currentDate) return;
    const fromIndex = dayPlaces.findIndex((place) => place.id === placeId);
    if (fromIndex < 0 || fromIndex === targetIndex) return;
    const next = [...dayPlaces];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorderDay(currentDate, next.map((place) => place.id));
  }

  function movePlace(placeId: string, direction: -1 | 1) {
    const fromIndex = dayPlaces.findIndex((place) => place.id === placeId);
    const targetIndex = fromIndex + direction;
    if (targetIndex < 0 || targetIndex >= dayPlaces.length) return;
    reorderPlace(placeId, targetIndex);
  }

  const dayTransit = currentDate ? transitPlans.filter((plan) => plan.plannedDate === currentDate) : [];
  const itineraryStops = [
    ...(dayHotel ? [{ id: `hotel-${dayHotel.id}`, name: dayHotel.name }] : []),
    ...dayPlaces.map((place) => ({ id: place.id, name: place.name })),
  ];
  const legs = transitLegs(itineraryStops, dayTransit);
  const placedTransitIds = new Set(legs.flatMap((leg) => [leg.direct?.id, ...leg.other.map((plan) => plan.id)].filter((id): id is string => Boolean(id))));
  const leftoverPlans = dayTransit.filter((plan) => !placedTransitIds.has(plan.id));

  async function removeTransitRide(id: string) {
    setRemovingTransitId(id);
    setTransitError("");
    try {
      await onRemoveTransit(id);
      setTransitDraft((current) => current?.plan?.id === id ? null : current);
    } catch {
      setTransitError("Couldn’t remove this ride. Try again.");
    } finally {
      setRemovingTransitId(null);
    }
  }

  return (
    <div className="day-plan">
      <div className="day-plan-intro">
        <div>
          <p className="eyebrow">Day plan</p>
          <strong>{searching ? `${matchedPlaces.length} ${matchedPlaces.length === 1 ? "match" : "matches"}` : `${plannedCount} planned · ${dates.length} ${dates.length === 1 ? "day" : "days"}`}</strong>
        </div>
        {searching ? null : (
          <div className="day-pagination" aria-label="Day pages">
            <button aria-label="Previous day" onClick={() => movePage(-1)} disabled={clampedPageIndex === 0} type="button"><ChevronLeft size={17} /></button>
            <select aria-label="Choose day" value={currentDate ?? ""} onChange={(event) => onFocusDate(event.target.value || null)}>
              {dates.map((date, index) => <option key={date} value={date}>Day {index + 1} · {formatDayHeading(date).date}</option>)}
              {hasUnplannedPage ? <option value="">Saved for later</option> : null}
            </select>
            <button aria-label="Next day" onClick={() => movePage(1)} disabled={clampedPageIndex >= totalPages - 1} type="button"><ChevronRight size={17} /></button>
          </div>
        )}
      </div>
      {searching ? (
        <section className="day-section">
          <header>
            <div>
              <span>Search</span>
              <h2>{query.trim()}</h2>
            </div>
          </header>
          <div className="day-place-list">
            {matchedPlaces.map((place, placeIndex) => {
              const number = String(placeIndex + 1).padStart(2, "0");
              return (
                <DayPlaceRow
                  canMoveDown={false}
                  canReorder={false}
                  cities={cities}
                  dragging={false}
                  dropTarget={false}
                  key={place.id}
                  number={number}
                  onDragEnd={() => undefined}
                  onDragOver={() => undefined}
                  onDragStart={() => undefined}
                  onDrop={() => undefined}
                  onMoveDown={() => undefined}
                  onMoveUp={() => undefined}
                  onEdit={() => onEditPlace(place)}
                  onRemove={() => onRemovePlace(place.id)}
                  onSelect={onSelectPlace}
                  onToggleSaved={onToggleSaved}
                  place={place}
                  selected={selectedId === place.id}
                />
              );
            })}
            {!matchedPlaces.length ? <p className="day-empty">No matching places.</p> : null}
          </div>
        </section>
      ) : null}
      {!searching && currentDate && label ? (
        <section className={`day-section${activeDate === currentDate ? " active" : ""}`}>
          <header>
            <div>
              <span>{label.day}</span>
              <h2>{label.date}</h2>
            </div>
            <DropdownMenu><DropdownMenuTrigger asChild><button className="place-menu-trigger" aria-label="Day options" type="button"><MoreHorizontal size={20} /></button></DropdownMenuTrigger>
              <DropdownMenuContent className="planner-menu" align="end">
                <DropdownMenuItem onSelect={() => dayHotel ? onEditHotel(dayHotel) : onAddHotel()}><BedDouble size={16} /> {dayHotel ? "Edit hotel stay" : "Add hotel stay"}</DropdownMenuItem>
                <DropdownMenuItem onSelect={onAddFlight}><Plane size={16} /> Add flight</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <details className="day-notes-disclosure">
            <summary><FileText size={14} /> {notes.length ? `${notes.length} day ${notes.length === 1 ? "note" : "notes"}` : "Add a day note"}<ChevronDown size={14} /></summary>
            <div className="day-notes">
              {notes.map((note) => <DayNoteRow key={note.id} note={note} onRemove={onRemoveNote} onUpdate={onUpdateNote} />)}
              <NoteComposer activeCityId={activeCityId} cities={cities} onAdd={(note, cityId) => onAddNote(currentDate, note, cityId)} />
            </div>
          </details>
          <div className="day-place-list">
            {itineraryStops.map((stop, index) => {
              const place = dayPlaces.find((item) => item.id === stop.id);
              const placeIndex = place ? dayPlaces.indexOf(place) : -1;
              const leg = legs[index];
              const direct = leg?.direct ?? null;
              const next = itineraryStops[index + 1];
              const editingHere = transitDraft?.fromId === stop.id;
              const number = String(placeIndex + 1).padStart(2, "0");
              return (
                <Fragment key={stop.id}>
                  {place ? (
                    <DayPlaceRow
                      canMoveDown={placeIndex < dayPlaces.length - 1}
                      cities={cities}
                      canReorder={canReorder}
                      dragging={draggingId === place.id}
                      dropTarget={dropTargetId === place.id}
                      number={number}
                      onDragEnd={() => { setDraggingId(null); setDropTargetId(null); }}
                      onDragOver={() => { if (canReorder) setDropTargetId(place.id); }}
                      onDragStart={() => setDraggingId(place.id)}
                      onDrop={() => { if (draggingId) reorderPlace(draggingId, placeIndex); setDraggingId(null); setDropTargetId(null); }}
                      onMoveDown={() => movePlace(place.id, 1)}
                      onMoveUp={() => movePlace(place.id, -1)}
                      onEdit={() => onEditPlace(place)}
                      onRemove={() => onRemovePlace(place.id)}
                      onSelect={onSelectPlace}
                      onToggleSaved={onToggleSaved}
                      place={place}
                      selected={selectedId === place.id}
                    />
                  ) : (
                    <button className="day-home-base" onClick={() => dayHotel && onEditHotel(dayHotel)} type="button"><span className="itinerary-rail"><span><BedDouble size={14} /></span></span><span><small>Stay</small><strong>{stop.name}</strong></span><Pencil size={14} /></button>
                  )}
                  {direct && !editingHere ? (
                    <TransitRideCard plan={direct} removing={removingTransitId === direct.id} onEdit={() => setTransitDraft({ fromId: stop.id, toId: direct.to.id, plan: direct })} onRemove={() => void removeTransitRide(direct.id)} />
                  ) : null}
                  {leg && !editingHere && !direct && next ? (
                    <button className="transit-gap" onClick={() => setTransitDraft({ fromId: stop.id, toId: next.id, plan: null })} type="button"><TramFront size={15} /><span className="transit-gap-label">Transit to {next.name}</span><span className="transit-gap-commute">Commute to {next.name}</span></button>
                  ) : null}
                  {leg && !editingHere ? leg.other.map((plan) => (
                    <TransitRideCard key={plan.id} plan={plan} removing={removingTransitId === plan.id} onEdit={() => setTransitDraft({ fromId: plan.from.id, toId: plan.to.id, plan })} onRemove={() => void removeTransitRide(plan.id)} />
                  )) : null}
                  {editingHere && transitDraft ? (
                    <div className="transit-leg-editor">
                      <TransitEditor
                        key={`${transitDraft.fromId}-${transitDraft.toId}-${transitDraft.plan?.id ?? "new"}`}
                        date={currentDate}
                        initialFromId={transitDraft.fromId}
                        initialToId={transitDraft.toId}
                        plan={transitDraft.plan}
                        stops={transitStops}
                        onCancel={() => setTransitDraft(null)}
                        onSave={async (draft) => { await onSaveTransit(draft); setTransitDraft(null); }}
                      />
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
            {leftoverPlans.map((plan) => (
              <TransitRideCard key={plan.id} plan={plan} removing={removingTransitId === plan.id} onEdit={() => setTransitDraft({ fromId: plan.from.id, toId: plan.to.id, plan })} onRemove={() => void removeTransitRide(plan.id)} />
            ))}
            {!dayPlaces.length && !dayHotel ? <p className="day-empty">{query.trim() ? "No matching places this day." : "No places planned for this day yet."}</p> : null}
            {transitError ? <p className="form-error" role="alert">{transitError}</p> : null}
          </div>
          {dayFlights.length ? (
            <div className="day-logistics">
              {dayFlights.length ? (
                <div className="flight-list" aria-label="Flights for this day">
                  {dayFlights.map(({ flight, moment }) => (
                    <button className="flight-strip" key={`${flight.id}-${moment}`} onClick={() => onEditFlight(flight)} type="button">
                      <span className="flight-strip-icon"><Plane size={16} /></span>
                      <span className="flight-strip-route"><small>{moment === "departing" ? "Departs today" : "Arrives today"} · {[flight.airline, flight.flightNumber].filter(Boolean).join(" · ") || "Flight"}</small><strong>{flight.departureAirport}<ArrowRight size={14} />{flight.arrivalAirport}</strong></span>
                      <span className="flight-strip-times"><strong>{flight.departureTime} <span>→</span> {flight.arrivalTime}</strong><small>{flight.plannedDate === flight.arrivalDate ? "Same day" : `Lands ${formatDayHeading(flight.arrivalDate).date}`}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {!searching && !currentDate && hasUnplannedPage ? (
        <section className="day-section unplanned-section">
          <header>
            <div><span>Unscheduled</span><h2>Saved for later</h2></div>
            <button className={!activeDate ? "active" : ""} onClick={() => onFocusDate(null)} type="button">Map all days</button>
          </header>
          <div className="day-place-list">
            {dayPlaces.map((place, placeIndex) => {
              const number = String(placeIndex + 1).padStart(2, "0");
              return (
                <DayPlaceRow
                  canMoveDown={false}
                  canReorder={false}
                  cities={cities}
                  dragging={false}
                  dropTarget={false}
                  key={place.id}
                  number={number}
                  onDragEnd={() => undefined}
                  onDragOver={() => undefined}
                  onDragStart={() => undefined}
                  onDrop={() => undefined}
                  onMoveDown={() => undefined}
                  onMoveUp={() => undefined}
                  onEdit={() => onEditPlace(place)}
                  onRemove={() => onRemovePlace(place.id)}
                  onSelect={onSelectPlace}
                  onToggleSaved={onToggleSaved}
                  place={place}
                  selected={selectedId === place.id}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DayPlaceRow({
  canMoveDown,
  canReorder,
  cities,
  dragging,
  dropTarget,
  number,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onEdit,
  onMoveDown,
  onMoveUp,
  onRemove,
  onSelect,
  onToggleSaved,
  place,
  selected,
}: {
  canMoveDown: boolean;
  canReorder: boolean;
  cities: CityStop[];
  dragging: boolean;
  dropTarget: boolean;
  number: string;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onEdit: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onSelect: (placeId: string) => void;
  onToggleSaved: (placeId: string) => void;
  place: Place;
  selected: boolean;
}) {
  const cityName = place.cityId ? cities.find((city) => city.id === place.cityId)?.name : null;

  return (
    <article
      className={`day-place${selected ? " selected" : ""}${canReorder ? " reorderable" : ""}${dragging ? " dragging" : ""}${dropTarget ? " drop-target" : ""}`}
      draggable={canReorder}
      id={`day-place-${place.id}`}
      onDragEnd={onDragEnd}
      onDragOver={(event) => { if (!canReorder) return; event.preventDefault(); onDragOver(); }}
      onDragStart={onDragStart}
      onDrop={(event) => { if (!canReorder) return; event.preventDefault(); onDrop(); }}
      onClick={() => onSelect(place.id)}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") onSelect(place.id);
      }}
      tabIndex={0}
      aria-label={`Show ${place.name} on the map`}
    >
      <div className="itinerary-rail"><span>{number}</span><i /></div>
      <PlacePhoto fsqPlaceId={place.fsqPlaceId} name={place.name} label={place.category} />
      <div className="saved-place-copy">
        <p className="place-kicker">
          <span className={`category-tag ${categoryClass(place.category)}`}>{place.category}</span>
          {place.neighborhood || cityName ? <span className="place-hood">{place.neighborhood || cityName}</span> : null}
        </p>
        <h2>{place.name}</h2>
        <small className="place-address">
          {place.address}
          <a
            href={buildGoogleMapsPlaceUrl(place)}
            aria-label={`Open ${place.name} in Google Maps`}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            🗺️
          </a>
        </small>
        {place.note ? <p className="place-note">{place.note}</p> : null}

        <div className="place-actions">
          <span className="contributor">Added by {place.addedBy}</span>
          {place.sourceUrl ? <a href={place.sourceUrl} onClick={(event) => event.stopPropagation()} target="_blank" rel="noreferrer">Original source <ExternalLink size={13} /></a> : null}
        </div>
      </div>
      <PlaceActions place={place} onEdit={onEdit} onToggleSaved={() => onToggleSaved(place.id)} onRemove={onRemove}
        onMoveUp={canReorder ? onMoveUp : undefined} onMoveDown={canReorder ? onMoveDown : undefined}
        first={number === "01"} last={!canMoveDown} />
    </article>
  );
}

function PlaceActions({ place, onEdit, onToggleSaved, onRemove, onMoveUp, onMoveDown, first, last }: {
  place: Place;
  onEdit: () => void;
  onToggleSaved: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div className="place-row-controls" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button className="place-menu-trigger" aria-label={`Options for ${place.name}`} type="button"><MoreHorizontal size={20} /></button></DropdownMenuTrigger>
        <DropdownMenuContent className="planner-menu" align="end" updatePositionStrategy="always">
          <DropdownMenuItem onSelect={onEdit}><Pencil size={16} /> Edit place & day</DropdownMenuItem>
          <DropdownMenuItem asChild><a href={buildGoogleMapsPlaceUrl(place)} target="_blank" rel="noreferrer"><MapPin size={16} /> Open in Google Maps</a></DropdownMenuItem>
          {onMoveUp ? <DropdownMenuItem disabled={first} onSelect={(event) => { event.preventDefault(); onMoveUp(); }}><ChevronUp size={16} /> Move earlier</DropdownMenuItem> : null}
          {onMoveDown ? <DropdownMenuItem disabled={last} onSelect={(event) => { event.preventDefault(); onMoveDown(); }}><ChevronDown size={16} /> Move later</DropdownMenuItem> : null}
          <DropdownMenuItem onSelect={onToggleSaved}><Bookmark size={16} /> {place.saved ? "Unsave place" : "Save place"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash2 size={16} /> Remove place</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NoteComposer({
  activeCityId,
  cities,
  onAdd,
}: {
  activeCityId: string;
  cities: CityStop[];
  onAdd: (note: string, cityId: string) => void;
}) {
  const [note, setNote] = useState("");
  const [cityId, setCityId] = useState("");
  const selectedCityId = activeCityId === "all" ? cityId || cities[0]?.id || "" : activeCityId;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    onAdd(trimmed, selectedCityId);
    setNote("");
  }

  return (
    <form className="note-composer" onSubmit={submit}>
      <FileText size={14} />
      <input value={note} onChange={(event) => setNote(event.target.value)} aria-label="Day note" placeholder="Add a note for this day" maxLength={500} />
      {activeCityId === "all" && cities.length > 1 ? (
        <select value={selectedCityId} onChange={(event) => setCityId(event.target.value)} aria-label="Note city">
          {cities.map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}
        </select>
      ) : null}
      <button type="submit">Add</button>
    </form>
  );
}

function DayNoteRow({
  note,
  onRemove,
  onUpdate,
}: {
  note: DayNote;
  onRemove: (noteId: string) => void;
  onUpdate: (noteId: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note.note);

  function save() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onUpdate(note.id, trimmed);
    setEditing(false);
  }

  return (
    <div className="day-note">
      {editing ? (
        <>
          <textarea value={value} onChange={(event) => setValue(event.target.value)} maxLength={500} rows={2} />
          <button onClick={save} type="button">Save</button>
        </>
      ) : (
        <>
          <p>{note.note}</p>
          <button onClick={() => setEditing(true)} type="button">Edit</button>
        </>
      )}
      <button aria-label="Delete note" onClick={() => onRemove(note.id)} type="button"><Trash2 size={13} /></button>
    </div>
  );
}

function AddCityDialog({
  details,
  onAdd,
  onClose,
}: {
  details: TripDetails;
  onAdd: (city: Omit<CityStop, "id" | "sortOrder">) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [error, setError] = useState("");

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
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const destination = String(data.destination ?? "").trim();
    if (!destination) {
      setError("Pick a city or country from the list.");
      return;
    }
    const startDate = String(data.startDate ?? "");
    const endDate = String(data.endDate ?? "");
    if (startDate && endDate && endDate < startDate) {
      setError("The city end date must be after its start date.");
      return;
    }
    onAdd({ ...parseCityStop(destination, details), startDate: startDate || null, endDate: endDate || null });
    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="place-dialog logistics-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="city-title" tabIndex={-1}>
        <header>
          <span className="dialog-step">Trip stop</span>
          <button className="icon-button" onClick={onClose} aria-label="Close" type="button"><X size={20} /></button>
        </header>
        <p className="eyebrow">Add another stop</p>
        <h2 id="city-title">Where else?</h2>
        <form className="new-trip-form" onSubmit={submit}>
          <CityField />
          <div className="date-fields">
            <label><span>Arrive</span><input defaultValue={details.startDate} name="startDate" type="date" /></label>
            <label><span>Leave</span><input defaultValue={details.endDate} name="endDate" type="date" /></label>
          </div>
          <p className="date-optional">Optional. Leave blank if this stop has no dates yet.</p>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button-ink button-full" type="submit">Add stop <MapPin size={17} /></button>
        </form>
      </section>
    </div>
  );
}
