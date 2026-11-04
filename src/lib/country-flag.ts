const ALIASES: Record<string, string> = {
  uk: "gb",
  usa: "us",
  us: "us",
  america: "us",
  "united states": "us",
  "united states of america": "us",
  "south korea": "kr",
  korea: "kr",
  "republic of korea": "kr",
  "korea republic of": "kr",
  "north korea": "kp",
  "united kingdom": "gb",
  britain: "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  "great britain": "gb",
  uae: "ae",
  "czech republic": "cz",
  czechia: "cz",
  vietnam: "vn",
  "viet nam": "vn",
  russia: "ru",
  "russian federation": "ru",
  taiwan: "tw",
  "hong kong": "hk",
  macau: "mo",
  macao: "mo",
  holland: "nl",
  "the netherlands": "nl",
  turkey: "tr",
  turkiye: "tr",
  "cote divoire": "ci",
  "ivory coast": "ci",
};

let regionNames: Map<string, string> | null = null;

function normalizeCountry(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function regionNameMap() {
  if (regionNames) return regionNames;
  regionNames = new Map();
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const name = display.of(code);
      if (!name || name === code) continue;
      regionNames.set(normalizeCountry(name), code.toLowerCase());
    }
  }
  return regionNames;
}

function lookupCode(value: string) {
  const normalized = normalizeCountry(value);
  if (!normalized) return null;
  return ALIASES[normalized] ?? regionNameMap().get(normalized) ?? null;
}

export function countryCodeFromName(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const candidate of [value.trim(), ...[...parts].reverse()]) {
    const code = lookupCode(candidate);
    if (code) return code;
  }
  return null;
}

export function flagCodeForTrip(trip: {
  country?: string | null;
  destination?: string | null;
  cities?: Array<{ country?: string | null; name?: string | null }>;
}) {
  const candidates = [
    trip.country,
    ...(trip.cities ?? []).flatMap((city) => [city.country, city.name]),
    trip.destination,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const code = countryCodeFromName(candidate);
    if (code) return code;
  }
  return null;
}

export function flagImageUrl(code: string) {
  return `https://flagcdn.com/w640/${code}.png`;
}
