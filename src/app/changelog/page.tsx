import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GitPullRequest } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { APP_VERSION, CHANGELOG, REPO_URL } from "@/lib/changelog";

export const metadata: Metadata = { title: "Changelog", description: "What's new in Tripboard, version by version." };

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function ChangelogPage() {
  return (
    <main className="app-page changelog-page">
      <header className="changelog-header">
        <Logo />
        <Link className="text-link" href="/"><ArrowLeft size={15} /> Back to Tripboard</Link>
      </header>
      <section className="changelog-shell">
        <p className="eyebrow">changelog</p>
        <h1>What&rsquo;s new.</h1>
        <p className="changelog-lede">You&rsquo;re on <strong>v{APP_VERSION}</strong>. Every release, newest first.</p>
        <ol className="changelog-list">
          {CHANGELOG.map((entry, index) => (
            <li className="changelog-entry" id={`v${entry.version}`} key={entry.version}>
              <div className="changelog-entry-rail">
                <a className={`changelog-version${index === 0 ? " latest" : ""}`} href={`#v${entry.version}`}>v{entry.version}</a>
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              </div>
              <div className="changelog-entry-body">
                <h2>
                  {entry.title}
                  {index === 0 ? <span className="changelog-latest">Latest</span> : null}
                </h2>
                <ul>
                  {entry.changes.map((change) => <li key={change}>{change}</li>)}
                </ul>
                {entry.pr ? (
                  <a className="changelog-pr" href={`${REPO_URL}/pull/${entry.pr}`} rel="noreferrer" target="_blank">
                    <GitPullRequest size={13} aria-hidden="true" /> #{entry.pr}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        <p className="changelog-note">Before v0.7.0 this repository held an earlier prototype.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
