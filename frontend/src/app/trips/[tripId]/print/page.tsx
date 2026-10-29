import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { formatMoney, personBalances, settleUp, totalSpent } from "@/lib/finances";
import { buildItinerary } from "@/lib/itinerary";
import { loadVisibleTrip } from "@/lib/trip-access";
import type { Flight } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }): Promise<Metadata> {
  const trip = await loadVisibleTrip((await params).tripId);
  return { title: trip ? `${trip.title} itinerary` : "Itinerary", robots: { index: false } };
}

function longDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

function journey(flight: Flight) {
  const mode = flight.mode === "train" ? "Train" : flight.mode === "bus" ? "Bus" : "Flight";
  const carrier = [flight.airline, flight.flightNumber].filter(Boolean).join(" ");
  return `${mode} ${flight.departureAirport} → ${flight.arrivalAirport} · ${flight.departureTime}–${flight.arrivalTime}${flight.arrivalDate !== flight.plannedDate ? ` (arrives ${longDay(flight.arrivalDate)})` : ""}${carrier ? ` · ${carrier}` : ""}`;
}

export default async function PrintItineraryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await loadVisibleTrip(tripId);
  if (!trip) notFound();
  const { days, unplanned } = buildItinerary(trip);
  const finances = trip.finances;
  const balances = finances ? settleUp(personBalances(finances.people, finances.expenses)) : [];
  const spentCents = totalSpent(finances?.expenses ?? []);

  return (
    <main className="itinerary-page">
      <nav className="itinerary-toolbar" aria-label="Itinerary actions">
        <Link className="button button-ghost" href={`/trips/${trip.id}`}><ArrowLeft size={16} /> Back to trip</Link>
        <a className="button button-ghost" href={`/trips/${trip.id}/calendar`}><CalendarPlus size={16} /> Add to calendar</a>
        <PrintButton />
      </nav>
      <header className="itinerary-head">
        <p>{trip.destination} · {trip.dateLabel}</p>
        <h1>{trip.title}</h1>
        {trip.collaborators.length ? <p>With {trip.collaborators.map((person) => person.name).join(", ")}</p> : null}
      </header>
      {trip.agenda.brief.trim() ? <section className="itinerary-brief"><h2>Notes</h2><p>{trip.agenda.brief}</p></section> : null}
      {days.map((day, index) => (
        <section className="itinerary-day" key={day.date}>
          <h2><span>Day {index + 1}</span>{longDay(day.date)}</h2>
          {day.journeys.map((flight) => <p className="itinerary-line itinerary-journey" key={flight.id}>{journey(flight)}</p>)}
          {day.hotel ? <p className="itinerary-line">Staying at <strong>{day.hotel.name}</strong>{day.hotel.address ? ` · ${day.hotel.address}` : ""}</p> : null}
          {day.places.length ? (
            <ol className="itinerary-places">
              {day.places.map((place) => <li key={place.id}><strong>{place.name}</strong>{place.address ? <span>{place.address}</span> : null}{place.note ? <em>{place.note}</em> : null}</li>)}
            </ol>
          ) : null}
          {day.notes.map((note) => <p className="itinerary-line itinerary-note" key={note.id}>{note.note}</p>)}
          {!day.journeys.length && !day.hotel && !day.places.length && !day.notes.length ? <p className="itinerary-line itinerary-empty">Nothing planned yet.</p> : null}
        </section>
      ))}
      {unplanned.length ? (
        <section className="itinerary-day">
          <h2><span>Saved</span>Not on a day yet</h2>
          <ul className="itinerary-places">{unplanned.map((place) => <li key={place.id}><strong>{place.name}</strong>{place.address ? <span>{place.address}</span> : null}</li>)}</ul>
        </section>
      ) : null}
      {finances?.expenses.length ? (
        <section className="itinerary-day">
          <h2><span>Money</span>{formatMoney(spentCents, finances.currency)} spent</h2>
          {balances.length ? balances.map((settlement) => <p className="itinerary-line" key={`${settlement.from}-${settlement.to}`}>{settlement.from} pays {settlement.to} {formatMoney(settlement.amountCents, finances.currency)}</p>) : <p className="itinerary-line">Everyone’s even.</p>}
        </section>
      ) : null}
    </main>
  );
}
