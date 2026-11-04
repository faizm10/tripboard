import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CollabPreview } from "@/components/landing-collab";
import { LandingDemo } from "@/components/landing-demo";
import { LandingMap } from "@/components/landing-map";
import { LandingStages } from "@/components/landing-stages";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Where the saves come from, said plainly once and never again. */
const sources = ["Instagram", "TikTok", "Group chats", "Notes app", "That one article"];

/**
 * Home. A full-height hero carrying the product still, then a short scroll:
 * how it works, the shared board, the demo trip. Server component — no client
 * JS on this route, so the board still renders without a Mapbox token.
 */
export default async function Home() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer && !viewer.demo);

  return (
    <main className="landing-page landing-page-scroll">
      <SiteHeader />

      <section className="hero-section" id="top">
        <div className="hero-copy">
          <p className="hero-badge">
            <span aria-hidden="true" />
            Beta
          </p>
          <h1>
            The places you save,
            <br />
            <em>on one map.</em>
          </h1>
          <p className="hero-lede">
            Instagram saves, group chats, and notes, turned into one board the whole group can walk.
          </p>
          <div className="hero-actions">
            <Link className="button button-ink button-large" href={signedIn ? "/trips" : "/sign-up"}>
              {signedIn ? "My trips" : "Start a trip"} <ArrowUpRight size={17} />
            </Link>
            {!signedIn ? (
              <a className="button button-large" href="#board">
                See a real board
              </a>
            ) : null}
          </div>
          <div className="hero-note">
            <span>One shared shortlist. No app to install.</span>
          </div>
        </div>
        <div className="hero-tray">
          <div className="hero-visual" id="board">
            <LandingMap />
          </div>
        </div>
      </section>

      <section className="source-band">
        <div className="source-band-inner">
          <strong>Saves come from everywhere.</strong>
          <ul>
            {sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section" id="how">
        <header className="home-section-head">
          <p className="eyebrow">How it works</p>
          <h2>Save the place, not the post.</h2>
          <p>
            Three steps between a screenshot you will never open again and a route you walk on
            Saturday morning.
          </p>
        </header>
        <LandingStages />
      </section>

      <section className="home-section home-section-tinted" id="together">
        <div className="home-split">
          <div className="home-split-copy">
            <p className="eyebrow">Plan together</p>
            <h2>Everyone adds. Nobody loses the link.</h2>
            <p>
              Invite the group by email or share a link. Every save is attributed, every note stays
              with the place, and the map updates for everyone at once.
            </p>
            {!signedIn ? (
              <Link className="button button-ink" href="/sign-up">
                Start a shared board <ArrowUpRight size={16} />
              </Link>
            ) : null}
          </div>
          <CollabPreview />
        </div>
      </section>

      <section className="home-section" id="demo">
        <LandingDemo signedIn={signedIn} />
      </section>

      <SiteFooter />
    </main>
  );
}
