"use client";

import { useState } from "react";
import {
  GOOGLE_AUTH_CHANNEL,
  GOOGLE_AUTH_MESSAGE,
  tripsUrlWithVerifier,
  type GoogleAuthMessage,
} from "@/lib/google-auth";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.97 10.97 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.59 6.59 0 0 1 5.5 12c0-.72.12-1.43.34-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}

function isGoogleAuthMessage(data: unknown): data is GoogleAuthMessage {
  return Boolean(data && typeof data === "object" && "type" in data && data.type === GOOGLE_AUTH_MESSAGE);
}

async function requestGoogleUrl(returnTo: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("returnTo", returnTo);
  const response = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "google",
      callbackURL: callback.toString(),
      disableRedirect: true,
    }),
  });
  const body = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !body.url) {
    throw new Error(body.error ?? "Google sign-in could not start.");
  }
  return body.url;
}

export function GoogleSignInButton({
  authEnabled,
  label,
  returnTo = "/trips",
}: {
  authEnabled: boolean;
  label: string;
  returnTo?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (!authEnabled) {
      setError("Google sign-in is unavailable right now.");
      return;
    }

    const tab = window.open("about:blank", "tripboard_google");
    setBusy(true);
    setError("");

    if (!tab) {
      try {
        const url = await requestGoogleUrl(returnTo);
        window.location.assign(url);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Google sign-in could not start.");
        setBusy(false);
      }
      return;
    }

    let settled = false;
    let channel: BroadcastChannel | null = null;

    function finish(verifier?: string | null) {
      if (settled) return;
      settled = true;
      cleanup();
      window.focus();
      window.location.replace(tripsUrlWithVerifier(verifier, returnTo));
    }

    function fail(message: string) {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        tab?.close();
      } catch {
        /* The Google tab may already be gone. */
      }
      setError(message);
      setBusy(false);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isGoogleAuthMessage(event.data)) return;
      finish(event.data.verifier);
    }

    function cleanup() {
      window.removeEventListener("message", onMessage);
      channel?.close();
      window.clearInterval(closedPoll);
      window.clearTimeout(timeout);
    }

    const closedPoll = window.setInterval(() => {
      if (tab.closed && !settled) fail("Google sign-in was closed before it finished.");
    }, 400);
    const timeout = window.setTimeout(() => {
      fail("Google sign-in took too long. Try again.");
    }, 120_000);

    window.addEventListener("message", onMessage);
    try {
      channel = new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
      channel.onmessage = (event) => {
        if (isGoogleAuthMessage(event.data)) finish(event.data.verifier);
      };
    } catch {
      channel = null;
    }

    try {
      tab.location.assign(await requestGoogleUrl(returnTo));
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : "Google sign-in could not start.");
    }
  }

  return (
    <div className="auth-google">
      <button
        className="button button-full google-button"
        disabled={busy || !authEnabled}
        type="button"
        onClick={() => void signIn()}
      >
        <GoogleMark />
        {busy ? "Waiting for Google…" : label}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
