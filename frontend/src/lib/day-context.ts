/** WMO weather codes, as used by Open-Meteo, grouped into plain words and an emoji. */
export function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear", icon: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Cloudy", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: "🌨️" };
  if (code >= 95) return { label: "Thunderstorms", icon: "⛈️" };
  return { label: "Mixed", icon: "🌤️" };
}

export type WeatherSource = { kind: "forecast"; date: string } | { kind: "history"; date: string } | { kind: "typical"; date: string };

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Forecasts only reach about 16 days out. Past days use recorded weather; days further ahead use the
 * same date last year as a rough guide, labelled so nobody mistakes it for a forecast.
 */
export function weatherSource(date: string, today: string): WeatherSource {
  const ahead = daysBetween(today, date);
  if (ahead >= 0 && ahead <= 15) return { kind: "forecast", date };
  if (ahead < 0) return { kind: "history", date };
  const lastYear = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
  return { kind: "typical", date: lastYear.endsWith("02-29") ? lastYear.replace("02-29", "02-28") : lastYear };
}

/** °F for the US and a few others that use it, °C everywhere else. */
export function formatTemperature(celsius: number, locale: string) {
  const fahrenheit = /^en-(US|LR|MM)$|-(US|BS|BZ|KY|PW)$/i.test(locale);
  return fahrenheit ? `${Math.round(celsius * 9 / 5 + 32)}°` : `${Math.round(celsius)}°`;
}

export type DayHours = { status: "open" | "closed" | "unknown"; text: string };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayOf(date: string) {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Google lists "Monday: 9:00 AM – 5:00 PM" per weekday; pick the trip day's line. */
export function hoursFromGoogle(weekdayDescriptions: string[] | undefined, date: string): DayHours {
  const weekday = weekdayOf(date);
  const line = weekdayDescriptions?.find((entry) => entry.startsWith(`${weekday}:`));
  if (!line) return { status: "unknown", text: "" };
  const hours = line.slice(weekday.length + 1).trim();
  if (/closed/i.test(hours)) return { status: "closed", text: `Closed on ${weekday}s` };
  if (/open 24 hours/i.test(hours)) return { status: "open", text: "Open 24 hours" };
  return { status: "open", text: `Open ${hours.replace(/ /g, " ")}` };
}

function clock(hhmm: string) {
  const hours = Number(hhmm.slice(0, 2));
  const minutes = hhmm.slice(2, 4);
  const suffix = hours >= 12 && hours < 24 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}${minutes === "00" ? "" : `:${minutes}`} ${suffix}`;
}

/** Foursquare's regular hours use day 1 = Monday … 7 = Sunday and "0900"-style times. */
export function hoursFromFoursquare(regular: { day: number; open: string; close: string }[] | undefined, date: string): DayHours {
  if (!regular?.length) return { status: "unknown", text: "" };
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  const fsqDay = jsDay === 0 ? 7 : jsDay;
  const slots = regular.filter((slot) => slot.day === fsqDay);
  if (!slots.length) return { status: "closed", text: `Closed on ${weekdayOf(date)}s` };
  return { status: "open", text: `Open ${slots.map((slot) => `${clock(slot.open)} – ${clock(slot.close.replace("+", ""))}`).join(", ")}` };
}
