"use client";

import { useQuery } from "@tanstack/react-query";
import { History, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type ActivityItem = { id: string; actorId: string; actorName: string; summary: string; createdAt: string };

/** Changes newer than `baseline` (newest first) made by someone other than the viewer. Undefined baseline means "not loaded yet". */
export function unseenSince(items: ActivityItem[], baseline: string | null | undefined, viewerId?: string) {
  if (baseline === undefined) return [];
  const index = baseline ? items.findIndex((item) => item.id === baseline) : items.length;
  return items.slice(0, index === -1 ? items.length : index).filter((item) => item.actorId !== viewerId);
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/**
 * Checks for changes every 20 seconds while the tab is visible. Changes by other people since the
 * trip was opened come back as `unseen`, so the workspace can offer a refresh instead of letting
 * edits silently overwrite each other.
 */
export function useTripActivity(tripId: string, viewerId: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ["trip-activity", tripId],
    queryFn: async () => (await fetch(`/api/trips/${tripId}/activity`)).json() as Promise<{ items?: ActivityItem[] }>,
    enabled,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const items = query.data?.items ?? [];
  // The newest entry when the trip was opened; anything after it is new to this viewer.
  const [baseline, setBaseline] = useState<string | null | undefined>(undefined);
  if (baseline === undefined && query.data) setBaseline(items[0]?.id ?? null);
  return { items, unseen: unseenSince(items, baseline, viewerId), dataUpdatedAt: query.dataUpdatedAt };
}

export function ActivityBanner({ unseen }: { unseen: ActivityItem[] }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const latest = unseen[0];
  if (!latest || dismissed === latest.id) return null;
  const others = new Set(unseen.map((item) => item.actorName));
  const lead = unseen.length === 1 ? `${latest.actorName} ${latest.summary}` : `${[...others].join(" and ")} made ${unseen.length} changes`;
  return (
    <div className="activity-banner" role="status">
      <span>{lead}.</span>
      <button className="button button-small button-ink" onClick={() => window.location.reload()} type="button"><RefreshCw size={14} /> Refresh to see it</button>
      <button className="icon-button" aria-label="Dismiss" onClick={() => setDismissed(latest.id)} type="button"><X size={16} /></button>
    </div>
  );
}

export function ActivityMenu({ items, now }: { items: ActivityItem[]; now: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button"><History size={14} /> Activity</button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="planner-menu activity-menu">
        <p className="activity-menu-title">Recent changes</p>
        {items.length ? (
          <ul>
            {items.slice(0, 20).map((item) => <li key={item.id}><strong>{item.actorName}</strong> {item.summary}<small>{timeAgo(item.createdAt, now)}</small></li>)}
          </ul>
        ) : <p className="activity-menu-empty">Changes you and your travel partners make show up here.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
