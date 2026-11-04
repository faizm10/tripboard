import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { MapFoldedMark, PostcardMark, WalkingPairMark } from "@/components/travel-marks";

export function AuthShell({
  children,
  eyebrow,
  title,
  lede,
  switchHref,
  switchLabel,
  switchAsButton = false,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  lede: string;
  switchHref: string;
  switchLabel: string;
  switchAsButton?: boolean;
}) {
  return (
    <main className="auth-page">
      <header>
        <Logo />
        <Link
          className={switchAsButton ? "button button-small button-ink" : "text-link"}
          href={switchHref}
        >
          {switchLabel}
        </Link>
      </header>
      <div className="auth-grid">
        <section className="auth-art" aria-hidden="true">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{lede}</p>
          <div className="auth-marks">
            <PostcardMark />
            <i />
            <MapFoldedMark />
            <i />
            <WalkingPairMark />
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}
