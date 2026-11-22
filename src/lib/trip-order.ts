export type TripSchedule = {
  startDate: string;
  endDate: string;
  title?: string;
};

export type TripWhen = "now" | "upcoming" | "open" | "past";

const rank: Record<TripWhen, number> = { now: 0, upcoming: 1, open: 2, past: 3 };

export function calendarDate(timeZone?: string, now = new Date()) {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try {
    return format(timeZone || "UTC");
  } catch {
    return format("UTC");
  }
}

export function tripWhen(trip: TripSchedule, today: string): TripWhen {
  if (!trip.startDate || !trip.endDate) return "open";
  if (trip.startDate <= today && today <= trip.endDate) return "now";
  if (trip.startDate > today) return "upcoming";
  return "past";
}

export function sortTrips<T extends TripSchedule>(trips: T[], today: string) {
  return [...trips].sort((left, right) => {
    const leftWhen = tripWhen(left, today);
    const rightWhen = tripWhen(right, today);
    if (leftWhen !== rightWhen) return rank[leftWhen] - rank[rightWhen];
    if (leftWhen === "past") return right.startDate.localeCompare(left.startDate) || (left.title ?? "").localeCompare(right.title ?? "");
    if (leftWhen === "open") return (left.title ?? "").localeCompare(right.title ?? "");
    return left.startDate.localeCompare(right.startDate) || (left.title ?? "").localeCompare(right.title ?? "");
  });
}

function dayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Whole calendar days from one YYYY-MM-DD date to another. */
export function daysBetween(from: string, to: string) {
  return Math.round(dayNumber(to) - dayNumber(from));
}

/** A short line for how far away a trip is, e.g. "In 12 days" or "Day 2 of 5". */
export function tripCountdown(trip: TripSchedule, today: string) {
  const when = tripWhen(trip, today);
  if (when === "open") return "No dates yet";
  if (when === "now") return `Day ${daysBetween(trip.startDate, today) + 1} of ${daysBetween(trip.startDate, trip.endDate) + 1}`;
  if (when === "past") return "Done";
  const days = daysBetween(today, trip.startDate);
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/**
 * The one trip the home screen leads with: the trip happening now, else the
 * next one with dates, else the first trip still being planned.
 */
export function spotlightTrip<T extends TripSchedule>(sorted: T[], today: string) {
  return sorted.find((trip) => tripWhen(trip, today) !== "past");
}
