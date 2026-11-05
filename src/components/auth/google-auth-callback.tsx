"use client";

import { useEffect } from "react";
import {
  GOOGLE_AUTH_CHANNEL,
  GOOGLE_AUTH_MESSAGE,
  SESSION_VERIFIER_PARAM,
  tripsUrlWithVerifier,
  type GoogleAuthMessage,
} from "@/lib/google-auth";

export function GoogleAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifier = params.get(SESSION_VERIFIER_PARAM);
    const returnTo = params.get("returnTo") || "/trips";
    const payload: GoogleAuthMessage = { type: GOOGLE_AUTH_MESSAGE, verifier };

    window.opener?.postMessage(payload, window.location.origin);
    try {
      const channel = new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch {
      /* BroadcastChannel is unavailable in some private contexts. */
    }

    if (window.opener) {
      window.close();
      return;
    }

    window.location.replace(tripsUrlWithVerifier(verifier, returnTo));
  }, []);

  return (
    <main className="auth-callback">
      <p className="eyebrow">Google</p>
      <h1>Signing you in.</h1>
      <p>This tab can close. Your trip list will open in the other one.</p>
    </main>
  );
}
