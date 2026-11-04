const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatDateLabel(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return "Dates later";
  const monthName = (iso: string) => months[Number(iso.slice(5, 7)) - 1] ?? "";
  const day = (iso: string) => String(Number(iso.slice(8, 10)));
  if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
    return `${monthName(startDate)} ${day(startDate)}—${day(endDate)}`;
  }
  return `${monthName(startDate)} ${day(startDate)}—${monthName(endDate)} ${day(endDate)}`;
}

/** A compact, timezone-safe label for a date stored as an ISO calendar day. */
export function formatWeekdayDate(iso?: string | null) {
  if (!iso) return "Not scheduled";
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  const weekday = date.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
  const calendarDate = date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${weekday} · ${calendarDate}`;
}

export function countryFromDestination(destination: string) {
  const parts = destination.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || destination;
}
