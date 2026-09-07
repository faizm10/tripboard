"use client";

import { initialsFromName } from "@/components/profile-avatar";
import type { Collaborator } from "@/lib/types";

const MAX_VISIBLE = 3;

function personLabel(person: Collaborator) {
  return person.email ? `${person.name}, ${person.email}` : person.name;
}

export function PresenceDock({
  people,
}: {
  people: Collaborator[];
}) {
  if (!people.length) return null;

  const visible = people.slice(0, MAX_VISIBLE);
  const overflow = people.length - visible.length;
  const rest = people.slice(MAX_VISIBLE);

  return (
    <div aria-label="People on this trip" className="presence-dock">
      {visible.map((person, index) => (
        <button
          aria-label={personLabel(person)}
          className="presence-tile"
          key={person.id ?? `${person.name}-${index}`}
          style={{ zIndex: visible.length - index }}
          type="button"
        >
          {person.image ? (
            <img alt="" referrerPolicy="no-referrer" src={person.image} />
          ) : (
            <span>{initialsFromName(person.name)}</span>
          )}
          <span className="presence-tip" role="tooltip">
            <strong>{person.name}</strong>
            {person.email ? <small>{person.email}</small> : null}
          </span>
        </button>
      ))}
      {overflow > 0 ? (
        <button
          aria-label={rest.map(personLabel).join("; ")}
          className="presence-tile presence-overflow"
          style={{ zIndex: 0 }}
          type="button"
        >
          <span>+{overflow}</span>
          <span className="presence-tip" role="tooltip">
            {rest.map((person) => (
              <span className="presence-tip-row" key={person.id ?? person.name}>
                <strong>{person.name}</strong>
                {person.email ? <small>{person.email}</small> : null}
              </span>
            ))}
          </span>
        </button>
      ) : null}
    </div>
  );
}
