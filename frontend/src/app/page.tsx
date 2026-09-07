import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingMap } from "@/components/landing-map";
import { SiteHeader } from "@/components/site-header";
import { WalkingPairMark } from "@/components/travel-marks";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="landing-page">
      <SiteHeader />

      <section className="hero-section">
        <div className="hero-copy">
          <h1>
            the places you save,
            <br />
            on one map.
          </h1>
          <div className="hero-aside">
            <p className="hero-lede">
              Instagram saves, group-chat links, and notes — turned into a trip you can actually walk.
            </p>
            <div className="hero-actions">
              <Link className="button button-ink" href="/sign-up">
                Start a trip <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="hero-note">
              <WalkingPairMark />
              <span>One shared shortlist for everyone going.</span>
            </div>
          </div>
        </div>
        <div className="hero-tray">
          <div className="hero-visual">
            <LandingMap />
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <strong>roamboard</strong>
          <span>Good places belong together.</span>
          <span>© 2026</span>
        </div>
        <div>
          <Link href="/sign-in">Sign in</Link>
          <a href="mailto:hello@roamboard.app">Say hello</a>
        </div>
      </footer>
    </main>
  );
}
