import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CollabPreview } from "@/components/landing-collab";
import { LandingDemo } from "@/components/landing-demo";
import { LandingMap } from "@/components/landing-map";
import { LandingStages } from "@/components/landing-stages";
import { SiteHeader } from "@/components/site-header";
import { getViewer } from "@/lib/auth";
import { WalkingPairMark } from "@/components/travel-marks";

export const dynamic = "force-dynamic";

/** Where the saves come from, said plainly once and never again. */
const sources = ["Instagram", "TikTok", "Group chats", "Notes app", "That one article"];

/**
 * Home. A full-height hero carrying the product still, then a short scroll:
 * how it works, the shared board, the demo trip. Server component — no client
 * JS on this route, so the board still renders without a Mapbox token.
 */
export default async function Home() {
  // Signed-in visitors get the app links; /sign-up is a dead end for them.
  const viewer = await getViewer();
  const signedIn = Boolean(viewer && !viewer.demo);
  const startHref = signedIn ? "/trips/new" : "/sign-up";

  return (
    <main className="landing-page landing-page-scroll">
      <SiteHeader />

      <section className="hero-section" id="top">
        <div className="hero-copy">
          <p className="hero-badge">
            <span aria-hidden="true" />
            Free while we are in beta
          </p>
          <h1>
            the places you save,
            <br />
            on one map.
          </h1>
          <p className="hero-lede">
            Tripboard turns Instagram saves, group-chat links and half-written notes into a shared
            trip you can actually walk.
          </p>
          <div className="hero-actions">
            <Link className="button button-ink button-large" href={startHref}>
              {signedIn ? "New trip" : "Start a trip"} <ArrowUpRight size={17} />
            </Link>
            <a className="button button-large" href="#board">
              See a real board
            </a>
          </div>
          <div className="hero-note">
            <WalkingPairMark />
            <span>One shared shortlist for everyone going. No app to install.</span>
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
            <Link className="button button-ink" href={startHref}>
              Start a shared board <ArrowUpRight size={16} />
            </Link>
          </div>
          <CollabPreview />
        </div>
      </section>

      <section className="home-section" id="demo">
        <LandingDemo />
      </section>

      <footer className="site-footer">
        <div>
          <strong>tripboard</strong>
          <span>© 2026</span>
        </div>
        <a
          aria-label="Tripboard on GitHub"
          className="site-footer-github"
          href="https://github.com/faizm10/tripboard"
          rel="noreferrer"
          target="_blank"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </a>
      </footer>
    </main>
  );
}
