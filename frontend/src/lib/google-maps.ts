import { formatCityLabel, type CityLocation, type CitySuggestion } from "@/lib/cities";
import type { PlaceCategory, PlaceSearchResult } from "@/lib/types";

const MAX_CITY_BBOX_SPAN_DEGREES = 4;

export function getGoogleMapsKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
}

export function googleMapsConfigured() {
  return Boolean(getGoogleMapsKey());
}

type GoogleSuggestion = {
  placePrediction?: {
    placeId?: string;
    types?: string[];
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
};

export function nameNeedsAddressLookup(name: string, address: string) {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[.,#\-–—]/g, " ").replace(/\s+/g, " ").trim();
  const normalizedName = normalize(name);
  const normalizedAddress = normalize(address);
  return Boolean(normalizedName && normalizedAddress && normalizedName === normalizedAddress);
}

export function cityFromGooglePrediction(
  prediction: GoogleSuggestion["placePrediction"],
  kind?: CitySuggestion["kind"],
): CitySuggestion | null {
  if (!prediction) return null;
  const name =
    prediction.structuredFormat?.mainText?.text?.trim() ||
    prediction.text?.text?.split(",")[0]?.trim();
  if (!name) return null;
  const secondary = prediction.structuredFormat?.secondaryText?.text?.trim() ?? "";
  const parts = secondary.split(",").map((part) => part.trim()).filter(Boolean);
  const country = parts.at(-1);
  const region = parts.length > 1 ? parts[0] : undefined;
  const isCountry = kind === "country" || prediction.types?.includes("country");
  return {
    id: prediction.placeId ?? name,
    name,
    label: isCountry ? name : formatCityLabel({ name, region, country }),
    region: isCountry ? undefined : region,
    country: isCountry ? name : country,
    kind: isCountry ? "country" : "city",
  };
}

export function categoryFromGoogleTypes(types: string[] = [], primaryType?: string): PlaceCategory {
  const labels = [primaryType, ...types].filter(Boolean).map((value) => value!.toLowerCase());
  if (
    labels.some(
      (label) =>
        label.includes("airport") ||
        label.includes("bus_station") ||
        label.includes("bus_stop") ||
        label.includes("ferry_terminal") ||
        label.includes("light_rail_station") ||
        label.includes("park_and_ride") ||
        label.includes("subway_station") ||
        label.includes("train_station") ||
        label.includes("transit") ||
        label.includes("transport"),
    )
  ) {
    return "Transit";
  }
  if (labels.some((label) => label.includes("cafe") || label.includes("coffee") || label.includes("bar") || label.includes("night_club"))) {
    return "Drink";
  }
  if (labels.some((label) => label.includes("restaurant") || label.includes("bakery") || label.includes("meal_") || label.includes("food"))) {
    return "Eat";
  }
  if (labels.some((label) => label.includes("lodging") || label.includes("hotel") || label.includes("guest_house"))) {
    return "Stay";
  }
  if (labels.some((label) => label.includes("store") || label.includes("shop") || label.includes("mall") || label.includes("market"))) {
    return "Shop";
  }
  if (
    labels.some(
      (label) =>
        label.includes("museum") ||
        label.includes("park") ||
        label.includes("tourist") ||
        label.includes("church") ||
        label.includes("landmark") ||
        label.includes("art_gallery"),
    )
  ) {
    return "See";
  }
  return "Other";
}

export function viewportToBbox(viewport?: {
  low?: { latitude?: number; longitude?: number };
  high?: { latitude?: number; longitude?: number };
  southwest?: { lat?: number; lng?: number };
  northeast?: { lat?: number; lng?: number };
}): CityLocation["bbox"] | undefined {
  let bbox: CityLocation["bbox"] | undefined;
  if (
    viewport?.low &&
    viewport?.high &&
    typeof viewport.low.longitude === "number" &&
    typeof viewport.low.latitude === "number" &&
    typeof viewport.high.longitude === "number" &&
    typeof viewport.high.latitude === "number"
  ) {
    bbox = [viewport.low.longitude, viewport.low.latitude, viewport.high.longitude, viewport.high.latitude];
  } else if (
    viewport?.southwest &&
    viewport?.northeast &&
    typeof viewport.southwest.lng === "number" &&
    typeof viewport.southwest.lat === "number" &&
    typeof viewport.northeast.lng === "number" &&
    typeof viewport.northeast.lat === "number"
  ) {
    bbox = [viewport.southwest.lng, viewport.southwest.lat, viewport.northeast.lng, viewport.northeast.lat];
  }
  if (!bbox) return undefined;
  const longitudeSpan = Math.abs(bbox[2] - bbox[0]);
  const latitudeSpan = Math.abs(bbox[3] - bbox[1]);
  if (longitudeSpan > MAX_CITY_BBOX_SPAN_DEGREES || latitudeSpan > MAX_CITY_BBOX_SPAN_DEGREES) return undefined;
  return bbox;
}

export async function googleCitySuggestions(query: string): Promise<CitySuggestion[] | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;
  const request = (includedPrimaryTypes: string[]) =>
    fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
      },
      body: JSON.stringify({
        input: query,
        languageCode: "en",
        includedPrimaryTypes,
      }),
      cache: "no-store",
    });
  const [placesResponse, countryResponse] = await Promise.all([
    request(["locality", "administrative_area_level_1"]).then((response) => (response.ok ? response : request(["locality"]))),
    request(["country"]),
  ]);
  if (!placesResponse.ok && !countryResponse.ok) return null;
  const [placesBody, countryBody] = await Promise.all([
    placesResponse.ok ? (placesResponse.json() as Promise<{ suggestions?: GoogleSuggestion[] }>) : Promise.resolve({ suggestions: [] }),
    countryResponse.ok ? (countryResponse.json() as Promise<{ suggestions?: GoogleSuggestion[] }>) : Promise.resolve({ suggestions: [] }),
  ]);
  const results: CitySuggestion[] = [];
  const seen = new Set<string>();
  for (const suggestion of countryBody.suggestions ?? []) {
    const place = cityFromGooglePrediction(suggestion.placePrediction, "country");
    if (!place || seen.has(place.label)) continue;
    seen.add(place.label);
    results.push(place);
    if (results.length === 6) break;
  }
  for (const suggestion of placesBody.suggestions ?? []) {
    const place = cityFromGooglePrediction(suggestion.placePrediction, "city");
    if (!place || seen.has(place.label)) continue;
    seen.add(place.label);
    results.push(place);
    if (results.length === 6) break;
  }
  return results;
}

export async function googleGeocode(query: string): Promise<CityLocation | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;
  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("address", query);
  endpoint.searchParams.set("key", key);
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    status?: string;
    results?: Array<{
      geometry?: {
        location?: { lat: number; lng: number };
        viewport?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
        bounds?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
      };
    }>;
  };
  const result = body.results?.[0];
  const location = result?.geometry?.location;
  if (body.status !== "OK" || typeof location?.lng !== "number" || typeof location.lat !== "number") return null;
  return {
    coordinates: [location.lng, location.lat],
    bbox: viewportToBbox(result?.geometry?.bounds) ?? viewportToBbox(result?.geometry?.viewport),
  };
}

export async function googlePlaceSearch(query: string, near: string): Promise<PlaceSearchResult[] | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: `${query} in ${near}`,
      languageCode: "en",
      maxResultCount: 7,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { places?: GooglePlace[] };
  return (body.places ?? []).flatMap((place) => {
    const longitude = place.location?.longitude;
    const latitude = place.location?.latitude;
    const name = place.displayName?.text?.trim();
    const id = place.id;
    if (!id || !name || typeof longitude !== "number" || typeof latitude !== "number") return [];
    const neighborhood =
      componentOf(place, "neighborhood") ||
      componentOf(place, "sublocality") ||
      componentOf(place, "locality") ||
      near;
    return [{
      fsqPlaceId: id,
      name,
      address: place.formattedAddress ?? "Address unavailable",
      neighborhood,
      coordinates: [longitude, latitude] as [number, number],
      category: categoryFromGoogleTypes(place.types, place.primaryType),
    }];
  });
}

/**
 * Finds the venue attached to an address. This is intentionally used only as
 * a fallback for old saves whose name is the address itself.
 */
export async function googlePlaceNameFromAddress(address: string, coordinates?: [number, number]): Promise<string | null> {
  const key = getGoogleMapsKey();
  if (!key || !address.trim()) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: address,
      languageCode: "en",
      maxResultCount: 1,
      ...(coordinates
        ? {
            locationBias: {
              circle: {
                center: { longitude: coordinates[0], latitude: coordinates[1] },
                radius: 75,
              },
            },
          }
        : {}),
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { places?: GooglePlace[] };
  const name = body.places?.[0]?.displayName?.text?.trim();
  return name && !nameNeedsAddressLookup(name, address) ? name : null;
}

export async function googlePlacePhotoUrl(placeId: string, placeName: string) {
  const key = getGoogleMapsKey();
  if (!key || placeId.startsWith("demo-")) return null;
  const details = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "photos",
    },
    cache: "no-store",
  });
  if (!details.ok) return null;
  const body = (await details.json()) as { photos?: Array<{ name?: string }> };
  const photoName = body.photos?.[0]?.name;
  if (!photoName) return null;
  const media = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&skipHttpRedirect=true`, {
    headers: { "X-Goog-Api-Key": key },
    cache: "no-store",
  });
  if (!media.ok) return null;
  const payload = (await media.json()) as { photoUri?: string };
  if (!payload.photoUri) return null;
  return {
    url: payload.photoUri,
    width: 800,
    height: 800,
    alt: `${placeName} from Google`,
    credit: "Photo via Google",
  };
}

function componentOf(place: GooglePlace, type: string) {
  return place.addressComponents?.find((component) => component.types?.includes(type))?.longText?.trim();
}
