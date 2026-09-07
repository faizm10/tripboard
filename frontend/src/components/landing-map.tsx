import type { CSSProperties } from "react";
import Image from "next/image";
import { Bookmark, MapPin } from "lucide-react";
import {
  fitView,
  projectToPercent,
  projectToPixels,
  staticMapUrl,
  walkingRoute,
  type LngLat,
  type MapView,
} from "@/lib/static-map";
import { categoryClass, type PlaceCategory } from "@/lib/types";

/**
 * A still of the trip workspace, built from the same places as the demo trip at
 * /trips/lisbon-weekender so the marketing page and the product agree.
 *
 * With a Mapbox token the basemap is a real static map of Lisbon and the route
 * is real walking geometry; without one it falls back to a drawn map so the
 * landing page still renders in demo mode. Pin/card hover linkage is CSS-only
 * (:has), which keeps this a server component.
 */
type BoardPlace = {
  key: string;
  index: string;
  name: string;
  category: PlaceCategory;
  neighborhood: string;
  note: string;
  coordinates: LngLat;
  /** Fallback position, used only when there is no basemap to project onto. */
  drawnPin: { top: string; left: string };
};

const places: BoardPlace[] = [
  {
    key: "gulbenkian",
    index: "01",
    name: "Gulbenkian Garden",
    category: "See",
    neighborhood: "Avenidas Novas",
    note: "Slow morning, sculpture garden, then coffee nearby.",
    coordinates: [-9.1544, 38.7367],
    drawnPin: { top: "18%", left: "18%" },
  },
  {
    key: "seagull",
    index: "02",
    name: "Seagull Method Café",
    category: "Drink",
    neighborhood: "Príncipe Real",
    note: "Breakfast before walking down to Chiado.",
    coordinates: [-9.1507, 38.7162],
    drawnPin: { top: "58%", left: "20%" },
  },
  {
    key: "prado",
    index: "03",
    name: "Prado Mercearia",
    category: "Eat",
    neighborhood: "Baixa",
    note: "Ana says the mushroom toast is non-negotiable.",
    coordinates: [-9.1349, 38.7107],
    drawnPin: { top: "76%", left: "52%" },
  },
  {
    key: "feira",
    index: "04",
    name: "Feira da Ladra",
    category: "Shop",
    neighborhood: "Alfama",
    note: "Tuesday flea market. Look for old ceramics.",
    coordinates: [-9.1256, 38.7151],
    drawnPin: { top: "62%", left: "78%" },
  },
];

/**
 * A square basemap survives the crop at both breakpoints: the panel is portrait
 * on desktop and landscape on mobile, and `fitView` padding keeps every pin well
 * inside whichever edges get trimmed.
 */
const MAP_WIDTH = 760;
const MAP_HEIGHT = 760;
const MAP_PADDING = 150;

type PinPosition = { top: string; left: string; align?: "end" };

function pinStyle(position: PinPosition, index: number) {
  return {
    top: position.top,
    left: position.left,
    "--pin-delay": `${240 + index * 90}ms`,
  } as CSSProperties;
}

function Pins({ positions }: { positions: PinPosition[] }) {
  return (
    <>
      {places.map((place, index) => (
        <span
          className="board-pin"
          data-align={positions[index].align}
          data-place={place.key}
          key={place.key}
          style={pinStyle(positions[index], index)}
        >
          <b>{place.index}</b>
          <i>{place.name.split(" ")[0]}</i>
        </span>
      ))}
    </>
  );
}

function DrawnMap() {
  return (
    <div className="board-geo board-geo-drawn">
      <svg className="board-terrain" viewBox="0 0 600 520" preserveAspectRatio="none">
        <rect className="board-land" width="600" height="520" />
        <g className="board-blocks">
          <rect x="150" y="120" width="120" height="86" rx="3" />
          <rect x="300" y="86" width="96" height="70" rx="3" />
          <rect x="196" y="240" width="150" height="96" rx="3" />
          <rect x="392" y="196" width="118" height="82" rx="3" />
          <rect x="66" y="330" width="104" height="74" rx="3" />
          <rect x="404" y="330" width="128" height="66" rx="3" />
        </g>
        <path className="board-park" d="M46 46h150q18 42 6 92-58 22-140 8-24-52-16-100Z" />
        <path className="board-water" d="M0 496 C 140 476, 246 456, 336 430 S 502 386, 600 356 L600 520 L0 520 Z" />
        <g className="board-roads">
          <path d="M-20 236 L620 160" />
          <path d="M-20 386 L620 300" />
          <path d="M96 -20 L188 540" />
          <path d="M372 -20 L436 540" />
          <path className="board-road-minor" d="M-20 122 L620 74" />
          <path className="board-road-minor" d="M256 -20 L300 540" />
        </g>
      </svg>
      <svg className="board-route" viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden="true">
        <path d="M108 94 C 90 180, 96 250, 120 302 S 240 372, 312 395 S 430 360, 468 322" />
      </svg>
      <Pins
        positions={places.map(({ drawnPin }) => ({
          ...drawnPin,
          align: Number.parseFloat(drawnPin.left) > 55 ? ("end" as const) : undefined,
        }))}
      />
      <span className="board-water-label">Rio Tejo</span>
    </div>
  );
}

function RealMap({ view, mapUrl, routePoints }: { view: MapView; mapUrl: string; routePoints: string }) {
  const positions: PinPosition[] = places.map((place) => {
    const { top, left } = projectToPercent(place.coordinates, view, MAP_WIDTH, MAP_HEIGHT);
    // Labels sit on the inside so they cannot run off the cropped edge.
    return { top: `${top.toFixed(3)}%`, left: `${left.toFixed(3)}%`, align: left > 55 ? "end" : undefined };
  });
  return (
    <div className="board-geo" style={{ "--map-ratio": `${MAP_WIDTH} / ${MAP_HEIGHT}` } as CSSProperties}>
      <Image
        alt=""
        className="board-basemap"
        height={MAP_HEIGHT}
        priority
        sizes="(max-width: 700px) 100vw, 520px"
        src={mapUrl}
        unoptimized
        width={MAP_WIDTH}
      />
      <svg className="board-route" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-hidden="true">
        <polyline className="board-route-casing" points={routePoints} />
        <polyline points={routePoints} />
      </svg>
      <Pins positions={positions} />
    </div>
  );
}

/** A straight run through the stops, used when real geometry is unavailable. */
function schematicRoute(view: MapView) {
  return places
    .map((place) => {
      const { x, y } = projectToPixels(place.coordinates, view, MAP_WIDTH, MAP_HEIGHT);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export async function LandingMap() {
  // The basemap URL is rendered into the page, so it may only ever carry the
  // intentionally public token. The Directions call happens server-side and
  // returns geometry, so it can use the secret token when one is configured.
  const basemapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
  const routeToken = process.env.MAPBOX_ACCESS_TOKEN?.trim() || basemapToken;
  const coordinates = places.map((place) => place.coordinates);
  const view = fitView(coordinates, MAP_WIDTH, MAP_HEIGHT, MAP_PADDING);
  const route = routeToken ? await walkingRoute(coordinates, routeToken) : null;

  const routePoints = route
    ? route.coordinates
        .map((point) => {
          const { x, y } = projectToPixels(point, view, MAP_WIDTH, MAP_HEIGHT);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : schematicRoute(view);

  const walkingMinutes = route ? Math.round(route.durationSeconds / 60) : 46;

  return (
    <figure className="board" aria-labelledby="board-caption">
      <figcaption className="sr-only" id="board-caption">
        A Tripboard trip: four places saved around Lisbon, each with the note that made it
        worth keeping, shown together on one map.
      </figcaption>

      <div className="board-map" aria-hidden="true">
        {basemapToken ? (
          <RealMap
            mapUrl={staticMapUrl({ view, width: MAP_WIDTH, height: MAP_HEIGHT, token: basemapToken })}
            routePoints={routePoints}
            view={view}
          />
        ) : (
          <DrawnMap />
        )}

        <p className="board-map-chip">
          <MapPin size={12} /> Lisbon · 4 places
        </p>
        <p className="board-route-chip">{walkingMinutes} min walking · 4 stops</p>
        {basemapToken ? <p className="board-attribution">© Mapbox © OpenStreetMap</p> : null}
      </div>

      <div className="board-list" aria-hidden="true">
        <header className="board-list-head">
          <p className="eyebrow">Portugal · Sep 18—22</p>
          <h2>Lisbon, loosely</h2>
          <span>Four places worth crossing town for.</span>
        </header>

        <div className="board-filters">
          <b>All</b>
          <span>Eat</span>
          <span>Drink</span>
          <span>See</span>
          <span>Shop</span>
        </div>

        <ul className="board-cards">
          {places.slice(0, 3).map((place) => (
            <li className="board-card" data-place={place.key} key={place.key}>
              <span className="board-card-index">{place.index}</span>
              <div className="board-card-body">
                <p className="board-card-meta">
                  <em className={`category-tag ${categoryClass(place.category)}`}>{place.category}</em>
                  <span>{place.neighborhood}</span>
                </p>
                <strong>{place.name}</strong>
                <q className="board-card-note">{place.note}</q>
              </div>
              <Bookmark className="board-card-save" size={15} />
            </li>
          ))}
        </ul>

        <p className="board-list-more">+ 1 more saved on this board</p>
      </div>
    </figure>
  );
}
