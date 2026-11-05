import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Mail,
  MapPin,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LandingMap } from "@/components/site/landing-map";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEMO_TRIP = "/trips/nyc-weekender";

/** Every line here is something the app does today — see /changelog. */
const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MapPin,
    title: "One map, one list",
    body: "Every save is a pin, kept with the note that says why it was worth saving.",
  },
  {
    icon: CalendarDays,
    title: "Day by day",
    body: "Each day shows the weather, opening hours and the route between stops, then hands off to Google or Apple Maps.",
  },
  {
    icon: Sparkles,
    title: "A trip assistant",
    body: "It reads your trip, finds real places near your hotel, and drops them on the map to add in one tap.",
  },
  {
    icon: Mail,
    title: "Paste a booking",
    body: "Drop in a confirmation email and the flight, train, bus or hotel files itself.",
  },
  {
    icon: Wallet,
    title: "Money, settled",
    body: "Log costs in any currency, split them however you like, and see who owes whom.",
  },
  {
    icon: Users,
    title: "Built for the group",
    body: "Invite by email or link. Everyone edits the same board, and the activity log shows who changed what.",
  },
];

/**
 * Home. A centred hero over the product still, six things the app does, and
 * one last call to act. Server
 * component, no client JS, and it renders without a Mapbox token.
 */
export default async function Home() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer && !viewer.demo);
  const primary = signedIn
    ? { href: "/trips", label: "My trips" }
    : { href: "/sign-up", label: "Start a trip" };

  return (
    <main className="lp">
      <SiteHeader />

      <div className="lp-frame">
        <section className="lp-hero" id="top">
          <div className="lp-ribbon" aria-hidden="true" />
          <p className="lp-kicker">
            <span>New</span> AI picks now land on your map
          </p>
          <h1>
            The places you save, <span>on one map.</span>
          </h1>
          <p className="lp-lede">
            Instagram saves, group-chat links and notes become one board your whole group plans
            from, then a day you can actually walk.
          </p>
          <div className="lp-actions">
            <Link className="button button-ink button-large" href={primary.href}>
              {primary.label} <ArrowRight size={17} />
            </Link>
            <Link className="button button-large" href={DEMO_TRIP}>
              Open the demo trip
            </Link>
          </div>
        </section>

        <div className="lp-shot">
          <LandingMap />
        </div>

        <section className="lp-features" id="features">
          <header className="lp-head">
            <p className="eyebrow">What it does</p>
            <h2>
              Save the place, not the post. <span>Then turn the shortlist into a day.</span>
            </h2>
          </header>
          <ul className="lp-grid">
            {features.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon aria-hidden="true" size={20} />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-cta">
          <h2>
            Your next trip is already in your saves.{" "}
            <span>Put it on one map.</span>
          </h2>
          <div className="lp-actions">
            <Link className="button button-ink button-large" href={primary.href}>
              {primary.label} <ArrowRight size={17} />
            </Link>
            <Link className="button button-large" href="/changelog">
              See what&apos;s new
            </Link>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
