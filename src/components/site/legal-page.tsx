import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { SiteFooter } from "@/components/site/site-footer";

export const CONTACT_EMAIL = "faizmustansar10@gmail.com";

/** Shared shell for the privacy policy and terms: plain prose, one column. */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <main className="app-page changelog-page">
      <header className="changelog-header">
        <Logo />
        <Link className="text-link" href="/"><ArrowLeft size={15} /> Back to Tripboard</Link>
      </header>
      <article className="changelog-shell legal-shell">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="changelog-lede">Last updated {updated}.</p>
        {children}
      </article>
      <SiteFooter />
    </main>
  );
}
