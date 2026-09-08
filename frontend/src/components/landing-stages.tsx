import { ArrowDown, Bookmark, Footprints, Link2 } from "lucide-react";
import { MapFoldedMark, PostcardMark, WalkingPairMark } from "@/components/travel-marks";

/**
 * Save → See → Plan. Each stage shows the thing it describes rather than only
 * naming it. The visuals are decorative stills of real product states, so they
 * are hidden from assistive tech; the heading and copy carry the meaning.
 */

function SaveVisual() {
  return (
    <div className="stage-visual stage-visual-save" aria-hidden="true">
      <p className="stage-source">
        <Link2 size={12} /> instagram.com/p/…
      </p>
      <ArrowDown className="stage-arrow" size={15} />
      <div className="stage-saved-card">
        <p className="stage-card-meta">
          <em className="category-tag category-eat">Eat</em>
          <span>West Village</span>
        </p>
        <strong>Joe’s Pizza</strong>
        <q>Go late — the line looks long and never is.</q>
        <Bookmark className="stage-card-save" size={13} />
      </div>
    </div>
  );
}

function SeeVisual() {
  return (
    <div className="stage-visual stage-visual-see" aria-hidden="true">
      <div className="stage-mini-map">
        <svg viewBox="0 0 200 130" preserveAspectRatio="none">
          <rect className="stage-mini-land" width="200" height="130" />
          <path className="stage-mini-water" d="M0 112q52-12 100-4t100-8v30H0Z" />
          <g className="stage-mini-roads">
            <path d="M-10 58 L210 38" />
            <path d="M-10 96 L210 78" />
            <path d="M62 -10 L82 140" />
            <path d="M140 -10 L152 140" />
          </g>
        </svg>
        <span className="stage-dot category-see" style={{ top: "22%", left: "20%" }} />
        <span className="stage-dot category-drink" style={{ top: "52%", left: "31%" }} />
        <span className="stage-dot category-eat" style={{ top: "70%", left: "54%" }} />
        <span className="stage-dot category-shop" style={{ top: "44%", left: "76%" }} />
        <p className="stage-mini-chip">4 places · one map</p>
      </div>
    </div>
  );
}

function PlanVisual() {
  const stops = [
    { time: "Morning", index: "01", name: "Washington Square Park" },
    { time: "Afternoon", index: "02", name: "Joe’s Pizza" },
    { time: "Evening", index: "03", name: "Chelsea Market" },
  ];
  return (
    <div className="stage-visual stage-visual-plan" aria-hidden="true">
      <ol className="stage-day">
        {stops.map((stop) => (
          <li key={stop.index}>
            <small>{stop.time}</small>
            <span className="stage-day-index">{stop.index}</span>
            <strong>{stop.name}</strong>
          </li>
        ))}
      </ol>
      <p className="stage-day-route">
        <Footprints size={13} /> 25 min walking
      </p>
    </div>
  );
}

const stages = [
  {
    id: "save",
    stage: "Save",
    mark: PostcardMark,
    title: "Save the place, not the post",
    copy: "A link, a recommendation, a passing thought — kept with the reason you kept it, so it still means something in three weeks.",
    visual: SaveVisual,
  },
  {
    id: "see",
    stage: "See",
    mark: MapFoldedMark,
    title: "See the trip take shape",
    copy: "Every save lands on one shared map. Distance stops being abstract, and the shape of the trip shows up on its own.",
    visual: SeeVisual,
  },
  {
    id: "plan",
    stage: "Plan",
    mark: WalkingPairMark,
    title: "Leave with a route",
    copy: "Give the good ones a day, put them in an order that walks, and hand the finished route to the app you navigate with.",
    visual: PlanVisual,
  },
];

export function LandingStages() {
  return (
    <div className="stage-list">
      {stages.map(({ id, stage, mark: Mark, title, copy, visual: Visual }, index) => (
        <article className="stage" id={`stage-${id}`} key={id}>
          <header className="stage-head">
            <span className="stage-step">{String(index + 1).padStart(2, "0")}</span>
            <Mark className="stage-mark" />
            <p className="stage-name">{stage}</p>
          </header>
          <div className="stage-copy">
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
          <Visual />
        </article>
      ))}
    </div>
  );
}
