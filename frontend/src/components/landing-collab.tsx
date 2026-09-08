import { categoryClass, type PlaceCategory } from "@/lib/types";

/** A still of a shared board: the same place list, with everyone's name on their own saves. */
const saves: { name: string; category: PlaceCategory; note: string; by: string }[] = [
  {
    name: "Chelsea Market",
    category: "Shop",
    note: "Go hungry, leave with olive oil.",
    by: "Faiz",
  },
  {
    name: "Washington Square Park",
    category: "See",
    note: "Start here. Chess tables, and someone always at the piano.",
    by: "Ana",
  },
  {
    name: "Caffè Reggio",
    category: "Drink",
    note: "The corner table, before it gets loud.",
    by: "Jon",
  },
];

export function CollabPreview() {
  return (
    <div className="collab-preview" aria-hidden="true">
      <div className="collab-preview-head">
        <p className="collab-avatars">
          {["F", "A", "J"].map((initial) => (
            <span key={initial}>{initial}</span>
          ))}
        </p>
        <span>3 planners</span>
      </div>
      <ul className="collab-saves">
        {saves.map((save) => (
          <li key={save.name}>
            <p className="collab-save-meta">
              <em className={`category-tag ${categoryClass(save.category)}`}>{save.category}</em>
              <strong>{save.name}</strong>
            </p>
            <q>{save.note}</q>
            <small>Added by {save.by}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
