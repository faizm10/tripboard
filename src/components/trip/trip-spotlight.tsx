import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { ProfileAvatar } from "@/components/account/profile-avatar";
import { CountryFlag } from "@/components/trip/country-flag";
import { PlacePhoto } from "@/components/trip/place-photo";
import { TripDeleteButton } from "@/components/trip/trip-delete-button";
import { flagCodeForTrip } from "@/lib/country-flag";
import { daysBetween, tripCountdown, tripWhen } from "@/lib/trip-order";
import type { Trip } from "@/lib/types";

/** The one thing worth doing next on this trip, so the home screen points somewhere. */
function nextStep(trip: Trip) {
  if (trip.places.length === 0) return "Save the first place";
  if (!trip.startDate) return "Pick dates to plan each day";
  if (trip.collaborators.length <= 1) return "Invite your group";
  return "Open the board";
}

/**
 * The trip the home screen leads with: a large card with a countdown, the
 * numbers that matter, and one suggested next step.
 */
export function TripSpotlight({ trip, today, canDelete = false }: { trip: Trip; today: string; canDelete?: boolean }) {
  const photoPlace = trip.places.find((place) => place.fsqPlaceId);
  const flagCode = flagCodeForTrip(trip);
  const happening = tripWhen(trip, today) === "now";
  const days = trip.startDate && trip.endDate ? daysBetween(trip.startDate, trip.endDate) + 1 : 0;

  return (
    <div className="trip-card-row trip-spotlight-row">
      <Link className={`trip-spotlight${happening ? " trip-spotlight-now" : ""}`} href={`/trips/${trip.id}`}>
        <div className="trip-spotlight-cover">
          {photoPlace ? (
            <PlacePhoto fsqPlaceId={photoPlace.fsqPlaceId} label={trip.destination} name={photoPlace.name} priority sizes="(max-width: 720px) 100vw, 360px" />
          ) : flagCode ? (
            <CountryFlag className="trip-spotlight-flag" code={flagCode} country={trip.country || trip.destination} />
          ) : (
            <div className="trip-spotlight-map" aria-hidden="true">
              <i className="pin pin-a" />
              <i className="pin pin-b" />
              <i className="pin pin-c" />
              <span>{trip.destination.split(",")[0]}</span>
            </div>
          )}
          <span className="trip-spotlight-countdown">{happening ? "Happening now · " : ""}{tripCountdown(trip, today)}</span>
        </div>
        <div className="trip-spotlight-body">
          <p className="eyebrow">{happening ? "On the road" : "Up next"}</p>
          <h2>{trip.title}</h2>
          <p className="trip-spotlight-where">
            {trip.destination} · {trip.dateLabel}
          </p>
          <dl className="trip-spotlight-stats">
            <div>
              <dt><MapPin aria-hidden="true" size={14} /> Places</dt>
              <dd>{trip.places.length}</dd>
            </div>
            <div>
              <dt><CalendarDays aria-hidden="true" size={14} /> Days</dt>
              <dd>{days || "—"}</dd>
            </div>
            <div>
              <dt><Users aria-hidden="true" size={14} /> People</dt>
              <dd>
                <span className="mini-avatars" aria-hidden="true">
                  {trip.collaborators.slice(0, 4).map((person) => (
                    <ProfileAvatar image={person.image} key={person.id ?? person.name} name={person.name} size="xs" />
                  ))}
                </span>
                {trip.collaborators.length}
              </dd>
            </div>
          </dl>
          <span className="trip-spotlight-next">
            {nextStep(trip)} <ArrowRight aria-hidden="true" size={16} />
          </span>
        </div>
      </Link>
      {canDelete ? <TripDeleteButton tripId={trip.id} title={trip.title} /> : null}
    </div>
  );
}
