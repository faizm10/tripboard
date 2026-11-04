import type { Flight, HotelStay } from "@/lib/types";

export const AGENDA_MAX_LENGTH = 20_000;

/** Path segments that are booking ids or noise rather than words a person would read. */
const NOISE_SEGMENT = /^(?:[a-z]{0,3}\d{4,}|[0-9a-f-]{16,}|index|default|home|en|en-[a-z]{2}|[a-z]{2}-[a-z]{2})$/i;

function titleCase(words: string) {
  return words.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

/**
 * A short, readable label for a pasted link, so a 600-character hotel URL
 * shows as "Namsan Hill Hotel Seoul South Korea" on "ca.hotels.com".
 */
export function describeLink(href: string): { host: string; title: string } {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { host: "", title: href.length > 60 ? `${href.slice(0, 57)}…` : href };
  }
  const host = url.hostname.replace(/^www\./, "");
  const segments = url.pathname.split("/").map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  const readable = segments
    .map((segment) => segment.replace(/\.(html?|php|aspx?)$/i, ""))
    .filter((segment) => segment && !NOISE_SEGMENT.test(segment) && /[a-z]/i.test(segment))
    .at(-1);
  const words = readable?.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  const title = words ? titleCase(words) : host;
  return { host, title: title.length > 64 ? `${title.slice(0, 61).trimEnd()}…` : title };
}

/**
 * Flips the checkbox of the task list item that starts at `offset` in the
 * markdown source. Returns the source unchanged when there's no box there.
 */
export function toggleTaskAt(source: string, offset: number) {
  const lineEnd = source.indexOf("\n", offset);
  const line = source.slice(offset, lineEnd === -1 ? undefined : lineEnd);
  const match = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/.exec(line);
  if (!match) return source;
  const boxAt = offset + match[1].length + 1;
  const next = match[2] === " " ? "x" : " ";
  return `${source.slice(0, boxAt)}${next}${source.slice(boxAt + 1)}`;
}

/** Counts finished and total checklist items so the header can show progress. */
export function taskProgress(source: string) {
  const boxes = source.match(/^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]/gm) ?? [];
  const done = boxes.filter((box) => /\[(x|X)\]$/.test(box)).length;
  return { done, total: boxes.length };
}

export function wordCount(source: string) {
  return source.replace(/https?:\/\/\S+/g, " link ").split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function shortDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A starting outline built from what the trip already knows. */
export function agendaTemplate({ title, flights, hotels }: { title: string; flights: Flight[]; hotels: HotelStay[] }) {
  const lines = [`# ${title || "Our trip"}`, ""];
  lines.push("## Getting there");
  if (flights.length) {
    for (const flight of flights.toSorted((a, b) => a.plannedDate.localeCompare(b.plannedDate))) {
      const label = [flight.airline, flight.flightNumber].filter(Boolean).join(" ") || "Ride";
      const when = [shortDate(flight.plannedDate), flight.departureTime].filter(Boolean).join(" ");
      lines.push(`- ${label}: ${flight.departureAirport || "?"} → ${flight.arrivalAirport || "?"}${when ? `, ${when}` : ""}`);
    }
  } else {
    lines.push("- ");
  }
  lines.push("", "## Where we're staying");
  if (hotels.length) {
    for (const hotel of hotels.toSorted((a, b) => a.startDate.localeCompare(b.startDate))) {
      lines.push(`- **${hotel.name}**, ${shortDate(hotel.startDate)} to ${shortDate(hotel.endDate)}`);
    }
  } else {
    lines.push("- ");
  }
  lines.push(
    "",
    "## Still to book",
    "- [ ] ",
    "",
    "## Packing",
    "- [ ] Passports",
    "- [ ] Chargers and adapters",
    "- [ ] Travel insurance details",
    "",
    "## Notes",
    "",
  );
  return lines.join("\n");
}
