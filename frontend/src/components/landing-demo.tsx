import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categoryClass, type PlaceCategory } from "@/lib/types";

/** Demo-trip preview: the four New York places, linking out to the public board. */
const stops: { index: string; name: string; category: PlaceCategory; area: string }[] = [
  { index: "01", name: "Washington Square Park", category: "See", area: "Greenwich Village" },
  { index: "02", name: "Caffè Reggio", category: "Drink", area: "Greenwich Village" },
  { index: "03", name: "Joe’s Pizza", category: "Eat", area: "West Village" },
  { index: "04", name: "Chelsea Market", category: "Shop", area: "Chelsea" },
];

export function LandingDemo({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="demo-block">
      <header className="demo-head">
        <div>
          <p className="eyebrow">Demo trip</p>
          <h2>{signedIn ? "See what a finished board looks like." : "Open a finished board before you sign up."}</h2>
          <p className="demo-lede">
            New York, loosely — four places, three planners, one walkable Saturday.
            {!signedIn ? " Nothing to install, no account." : null}
          </p>
        </div>
        {!signedIn ? (
          <Link className="button button-ink button-large" href="/trips/nyc-weekender">
            Open the demo trip <ArrowUpRight size={17} />
          </Link>
        ) : null}
      </header>
      <ul className="demo-stops">
        {stops.map((stop) => (
          <li key={stop.index}>
            <p className="demo-stop-meta">
              <span>{stop.index}</span>
              <em className={`category-tag ${categoryClass(stop.category)}`}>{stop.category}</em>
            </p>
            <strong>{stop.name}</strong>
            <small>{stop.area}</small>
          </li>
        ))}
      </ul>
      <p className="demo-foot">25 min walking · 4 stops · route hands off to Google or Apple Maps</p>
    </div>
  );
}
