"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Fallback for any page that fails to load, most often because the database
 * or sign-in is down. Production hides the real error, so the copy stays
 * general and points people at the status page.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-error">
      <div>
        <p className="eyebrow">Something went wrong</p>
        <h1>This page couldn&apos;t load.</h1>
        <p>
          Tripboard may be having trouble reaching your trips right now. Your trips and places are safe. Try again in a
          moment, or check the status page to see if something is down.
        </p>
        <div className="app-error-actions">
          <button className="button button-ink" type="button" onClick={() => retry()}>
            Try again
          </button>
          <Link className="text-link" href="/status">
            Status page
          </Link>
        </div>
      </div>
    </main>
  );
}
