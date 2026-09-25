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
