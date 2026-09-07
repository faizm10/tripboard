import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { CountryFlag } from "@/components/country-flag";
import { PlacePhoto } from "@/components/place-photo";
import { ProfileAvatar } from "@/components/profile-avatar";
import { flagCodeForTrip } from "@/lib/country-flag";
import type { Collaborator, Trip } from "@/lib/types";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function peopleLabel(people: Collaborator[]) {
  const names = people.map((person) => firstName(person.name));
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function TripCard({ trip, index }: { trip: Trip; index: number }) {
  const coverPlace = trip.places[0];
  const flagCode = flagCodeForTrip(trip);
  const initials = (trip.country || trip.destination).slice(0, 2);
  const people = trip.collaborators;
  const shownPeople = people.slice(0, 4);

  return (
    <Link className="trip-card" href={`/trips/${trip.id}`}>
      <div className="trip-cover">
        {flagCode ? (
          <CountryFlag code={flagCode} country={trip.country || trip.destination} />
        ) : coverPlace?.fsqPlaceId ? (
          <PlacePhoto fsqPlaceId={coverPlace.fsqPlaceId} name={coverPlace.name} label={trip.destination} sizes="(max-width: 700px) 100vw, 180px" priority={index === 0} />
        ) : (
          <div className="trip-cover-fallback">{initials}</div>
        )}
        <span className="trip-index">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="trip-card-body">
        <div>
          <p className="eyebrow">{trip.country} · {trip.dateLabel}</p>
          <h2>{trip.title}</h2>
          <p className="trip-destination">{trip.destination}</p>
        </div>
        <ArrowUpRight className="trip-arrow" size={24} />
        <div className="trip-meta">
          <span><MapPin size={14} /> {trip.places.length} places</span>
          {people.length > 0 ? (
            <span className="trip-people" title={people.map((person) => person.name).join(", ")}>
              <span className="mini-avatars" aria-hidden="true">
                {shownPeople.map((person) => (
                  <ProfileAvatar image={person.image} key={person.id ?? person.name} name={person.name} size="xs" />
                ))}
              </span>
              <span className="trip-people-names">{peopleLabel(people)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
