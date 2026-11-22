import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { AppHeader } from "@/components/site/app-header";
import { SiteFooter } from "@/components/site/site-footer";
import { TripCard } from "@/components/trip/trip-card";
import { TripSpotlight } from "@/components/trip/trip-spotlight";
import { getViewer } from "@/lib/auth";
import { demoTrips } from "@/lib/demo-data";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";
import { calendarDate, sortTrips, spotlightTrip, tripCountdown, tripWhen } from "@/lib/trip-order";
import { listViewerTrips, toTripViewer } from "@/lib/trips";
import type { Trip } from "@/lib/types";
import { isPersistedTripId } from "@/lib/types";

export const metadata: Metadata = { title: "Your trips" };
export const dynamic = "force-dynamic";

const FIRST_STEPS = [
  { title: "Pick a place", body: "Name the trip and where it goes. Dates can wait." },
  { title: "Save what you find", body: "Search spots or paste links from Instagram and group chats." },
  { title: "Plan it together", body: "Invite the group, sort places into days, split the costs." },
];

function greeting(timeZone: string) {
  let hour = new Date().getUTCHours();
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()));
  } catch {}
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function summary(spotlight: Trip | undefined, today: string) {
  if (!spotlight) return "No trips on the horizon. Where to next?";
  const place = spotlight.destination.split(",")[0];
  const when = tripWhen(spotlight, today);
  if (when === "now") return `You're in ${place} right now. Enjoy it.`;
  if (when === "upcoming") return `${place} is ${tripCountdown(spotlight, today).toLowerCase()}.`;
  return `${place} is still taking shape.`;
}

export default async function TripsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.restricted) redirect("/sign-in?restricted=1");

  const firstName = viewer.name?.split(" ")[0] ?? "Traveller";
  const headerStore = await headers();
  const timeZone = headerStore.get("x-vercel-ip-timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = calendarDate(timeZone);
  const trips = sortTrips(viewer.demo ? demoTrips : await listViewerTrips(toTripViewer(viewer)), today);

  // A brand-new account gets the welcome flow once; after that an empty list shows the empty state.
  if (!viewer.demo && trips.length === 0 && !(await cookies()).has(ONBOARDED_COOKIE)) redirect("/welcome");

  const spotlight = spotlightTrip(trips, today);
  const indexedTrips = trips.map((trip, index) => ({ trip, index })).filter(({ trip }) => trip !== spotlight);
  const sections = [
    { title: "Upcoming", trips: indexedTrips.filter(({ trip }) => ["now", "upcoming"].includes(tripWhen(trip, today))) },
    { title: "In planning", trips: indexedTrips.filter(({ trip }) => tripWhen(trip, today) === "open") },
    { title: "Past", trips: indexedTrips.filter(({ trip }) => tripWhen(trip, today) === "past") },
  ];
  const companions = new Set(
    trips.flatMap((trip) => trip.collaborators.filter((person) => person.id !== viewer.id).map((person) => person.email || person.name)),
  );
  const stats = [
    { label: trips.length === 1 ? "Trip" : "Trips", value: trips.length },
    { label: "Places saved", value: trips.reduce((total, trip) => total + trip.places.length, 0) },
    { label: "Destinations", value: new Set(trips.map((trip) => trip.country || trip.destination)).size },
    { label: "Travel mates", value: companions.size },
  ];
  const empty = trips.length === 0 && !viewer.demo;
  const canDelete = (trip: Trip) =>
    isPersistedTripId(trip.id) && trip.collaborators.some((person) => person.id === viewer.id && person.role === "owner");

  return (
    <main className="app-page">
      <AppHeader demo={viewer.demo} email={viewer.email} image={viewer.image} name={viewer.name ?? firstName} />
      <section className="trips-shell">
        <div className="trips-heading">
          <div className="trips-heading-copy">
            <p className="eyebrow">{greeting(timeZone)}, {firstName}</p>
            <h1>{empty ? "Let's plan your first trip." : summary(spotlight, today)}</h1>
          </div>
          <Link className="button button-ink" href="/trips/new">
            New trip <Plus size={17} />
          </Link>
        </div>

        {empty ? (
          <div className="trips-empty">
            <ol className="trips-empty-steps">
              {FIRST_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span>{index + 1}</span>
                  <h2>{step.title}</h2>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="trips-empty-actions">
              <Link className="button button-ink button-large" href="/welcome">
                Start a trip <ArrowRight size={17} />
              </Link>
              <Link className="button button-large" href="/trips/nyc-weekender">
                Look around the demo trip
              </Link>
            </div>
          </div>
        ) : (
          <>
            {spotlight ? <TripSpotlight canDelete={canDelete(spotlight)} today={today} trip={spotlight} /> : null}
            <dl className="trips-stats">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dd>{stat.value}</dd>
                  <dt>{stat.label}</dt>
                </div>
              ))}
            </dl>
            <div className="trip-index-list">
              {sections.filter((section) => section.trips.length > 0).map((section) => (
                <section aria-label={section.title} className="trip-index-section" key={section.title}>
                  <div className="trip-index-section-heading">
                    <h2>{section.title}</h2>
                    <span>{section.trips.length}</span>
                  </div>
                  <div className="trip-index-section-cards">
                    {section.trips.map(({ trip, index }) => (
                      <TripCard
                        canDelete={canDelete(trip)}
                        index={index}
                        key={trip.id}
                        today={today}
                        trip={trip}
                      />
                    ))}
                  </div>
                </section>
              ))}
              <Link className="new-trip-card" href="/trips/new">
                <span>
                  <Plus size={22} />
                </span>
                <div>
                  <p className="eyebrow">Blank trip</p>
                  <h2>Start somewhere new</h2>
                </div>
              </Link>
            </div>
          </>
        )}
        {viewer.demo ? (
          <p className="demo-note">Demo mode · Connect Neon and provider keys for live accounts, places, and maps.</p>
        ) : null}
      </section>
      <SiteFooter />
    </main>
  );
}
