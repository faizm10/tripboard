"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { describeWeather, formatTemperature, type DayHours } from "@/lib/day-context";

type Weather = { kind: "forecast" | "history" | "typical" | "none"; code?: number; high?: number; low?: number; rainChance?: number | null; rainMm?: number | null };

/** A one-line weather summary for a trip day, near the day's hotel or first stop. */
export function DayWeather({ coordinates, date }: { coordinates?: [number, number] | null; date: string }) {
  const [lng, lat] = coordinates ?? [];
  const weather = useQuery({
    queryKey: ["weather", lat?.toFixed(2), lng?.toFixed(2), date],
    queryFn: async () => (await fetch(`/api/weather?lat=${lat}&lng=${lng}&date=${date}`)).json() as Promise<Weather>,
    enabled: lat != null && lng != null,
    staleTime: 60 * 60 * 1000,
  });
  const data = weather.data;
  if (!data || data.kind === "none" || data.high == null || data.low == null) return null;
  const locale = typeof navigator === "undefined" ? "en" : navigator.language;
  const { icon, label } = describeWeather(data.code ?? -1);
  const temps = `${formatTemperature(data.high, locale)} / ${formatTemperature(data.low, locale)}`;
  const rain = data.kind === "forecast" ? (data.rainChance ? ` · ${data.rainChance}% rain` : "") : data.rainMm ? ` · ${Math.round(data.rainMm)} mm rain` : "";
  const prefix = data.kind === "typical" ? "Last year on this date: " : data.kind === "history" ? "Weather that day: " : "";
  return (
    <p className={`day-weather${data.kind === "typical" ? " typical" : ""}`} title={data.kind === "typical" ? "Forecasts start about two weeks before the day. Until then this shows the same date last year." : undefined}>
      <span aria-hidden="true">{icon}</span> {prefix}{label} · {temps}{rain}
    </p>
  );
}

/** Whether a stop is open on the day it's planned. Quiet when hours aren't known. */
export function PlaceHours({ date, placeId }: { date: string; placeId: string }) {
  const hours = useQuery({
    queryKey: ["hours", placeId, date],
    queryFn: async () => (await fetch(`/api/places/${encodeURIComponent(placeId)}/hours?date=${date}`)).json() as Promise<DayHours>,
    staleTime: 6 * 60 * 60 * 1000,
    enabled: Boolean(placeId) && !placeId.startsWith("demo-"),
  });
  if (!hours.data || hours.data.status === "unknown") return null;
  return <small className={`place-hours ${hours.data.status}`}><Clock size={12} /> {hours.data.text}</small>;
}
