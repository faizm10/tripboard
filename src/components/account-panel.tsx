"use client";

import { useActionState, useState } from "react";
import {
  signOut,
  updateAccountName,
  type AccountFormState,
} from "@/lib/auth-actions";
import { ProfileAvatar } from "@/components/profile-avatar";

export function AccountPanel({
  demo,
  email,
  image,
  name,
}: {
  demo: boolean;
  email: string;
  image?: string | null;
  name: string;
}) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(
    updateAccountName,
    null,
  );
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.replace("/sign-in");
    }
  }

  return (
    <div className="account-panel">
      <div className="account-identity">
        <ProfileAvatar image={image} name={state?.name ?? name} size="lg" />
        <div>
          <h2>{state?.name ?? name}</h2>
          <p>{email}</p>
        </div>
      </div>

      <form action={formAction} className="account-form">
        <label className="field-label" htmlFor="name">
          <span>Name</span>
          <input
            autoComplete="name"
            defaultValue={state?.name ?? name}
            id="name"
            name="name"
            required
            type="text"
          />
        </label>
        <label className="field-label" htmlFor="email">
          <span>Email</span>
          <input disabled id="email" readOnly type="email" value={email} />
        </label>
        <p className="account-hint">Email stays with the sign-in you already use.</p>
        {state?.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <button className="button button-ink button-full" disabled={pending || demo} type="submit">
          {pending ? "Saving…" : "Save name"}
        </button>
      </form>

      <div className="account-sign-out">
        <button
          className="button button-full"
          disabled={demo || signingOut}
          type="button"
          onClick={() => void handleSignOut()}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <p className="form-footnote">
          {demo
            ? "Sign-out needs a live account. You can still browse the demo trips."
            : "You can always come back to your boards."}
        </p>
      </div>
    </div>
  );
}
