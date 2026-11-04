export type CityLocation = {
  coordinates: [longitude: number, latitude: number];
  bbox?: [number, number, number, number];
};

export type CitySuggestion = {
  id: string;
  name: string;
  label: string;
  region?: string;
  country?: string;
  kind?: "city" | "country";
  coordinates?: [longitude: number, latitude: number];
};

export const demoCities: CitySuggestion[] = [
  { id: "lisbon", name: "Lisbon", country: "Portugal", kind: "city", label: "Lisbon, Portugal", coordinates: [-9.1393, 38.7139] },
  { id: "kyoto", name: "Kyoto", country: "Japan", kind: "city", label: "Kyoto, Japan", coordinates: [135.7681, 35.0116] },
  { id: "montreal", name: "Montréal", country: "Canada", region: "Quebec", kind: "city", label: "Montréal, Canada", coordinates: [-73.5673, 45.5017] },
  { id: "mexico-city", name: "Mexico City", country: "Mexico", kind: "city", label: "Mexico City, Mexico", coordinates: [-99.1332, 19.4326] },
  { id: "marrakesh", name: "Marrakesh", country: "Morocco", kind: "city", label: "Marrakesh, Morocco", coordinates: [-7.9811, 31.6295] },
  { id: "oslo", name: "Oslo", country: "Norway", kind: "city", label: "Oslo, Norway", coordinates: [10.7522, 59.9139] },
  { id: "south-korea", name: "South Korea", country: "South Korea", kind: "country", label: "South Korea", coordinates: [127.7669, 35.9078] },
  { id: "portugal", name: "Portugal", country: "Portugal", kind: "country", label: "Portugal", coordinates: [-8.2245, 39.3999] },
  { id: "japan", name: "Japan", country: "Japan", kind: "country", label: "Japan", coordinates: [138.2529, 36.2048] },
];

export function formatCityLabel(city: { name: string; region?: string; country?: string }) {
  if (city.country && city.country !== city.name) return `${city.name}, ${city.country}`;
  if (city.region && city.region !== city.name) return `${city.name}, ${city.region}`;
  return city.name;
}

export function filterDemoCities(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return demoCities.slice(0, 6);
  return demoCities.filter((city) => city.label.toLowerCase().includes(needle)).slice(0, 6);
}

export function demoCityLocation(query: string): CityLocation | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const match =
    demoCities.find((city) => city.label.toLowerCase() === needle || city.name.toLowerCase() === needle) ??
    demoCities.find((city) => city.label.toLowerCase().includes(needle) || city.name.toLowerCase().includes(needle));
  if (!match?.coordinates) return null;
  return { coordinates: match.coordinates };
}
