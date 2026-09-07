"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  signInWithEmail,
  signUpWithEmail,
  type AuthFormState,
} from "@/lib/auth-actions";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

type AuthMode = "sign-in" | "sign-up";

function PasswordField({
  id,
  name,
  autoComplete,
  label,
  hint,
}: {
  id: string;
  name: string;
  autoComplete: string;
  label: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const revealLabel = label.toLowerCase();
  return (
    <label className="field-label" htmlFor={id}>
      <span>{label}</span>
      <div className="password-field">
        <input
          autoComplete={autoComplete}
          id={id}
          minLength={autoComplete === "new-password" ? 8 : undefined}
          name={name}
          required
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? `Hide ${revealLabel}` : `Show ${revealLabel}`}
          className="password-toggle"
          type="button"
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function AuthForm({
  authEnabled,
  mode,
  restricted = false,
  returnTo = "/trips",
}: {
  authEnabled: boolean;
  mode: AuthMode;
  restricted?: boolean;
  returnTo?: string;
}) {
  const action = mode === "sign-in" ? signInWithEmail : signUpWithEmail;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    null,
  );
  const isSignUp = mode === "sign-up";

  useEffect(() => {
    if (state?.ok) window.location.replace(state.returnTo || returnTo);
  }, [returnTo, state]);

  return (
    <div className="auth-panel">
      <p className="eyebrow">{isSignUp ? "Create account" : "Sign in"}</p>
      <h1>{isSignUp ? "Start keeping places." : "Welcome back."}</h1>
      <p className="auth-lede">
        {isSignUp
          ? "Save spots, invite the people going with you, and keep every trip on one map."
          : "Open your boards, pick up a shared trip, and keep planning from where you left off."}
      </p>

      {restricted ? <p className="form-error" role="alert">Your account has been restricted. Contact Tripboard support if you believe this is a mistake.</p> : null}

      <form action={formAction} className="auth-form" key={state?.error ?? "ready"}>
        <input name="returnTo" type="hidden" value={state?.returnTo ?? returnTo} />
        {isSignUp ? (
          <label className="field-label" htmlFor="name">
            <span>Name</span>
            <input
              autoComplete="name"
              defaultValue={state?.values?.name}
              id="name"
              name="name"
              placeholder="Your name"
              required
              type="text"
            />
          </label>
        ) : null}

        <label className="field-label" htmlFor="email">
          <span>Email</span>
          <input
            autoComplete="email"
            defaultValue={state?.values?.email}
            id="email"
            inputMode="email"
            name="email"
            placeholder="you@email.com"
            required
            spellCheck={false}
            type="email"
          />
        </label>

        <PasswordField
          autoComplete={isSignUp ? "new-password" : "current-password"}
          hint={isSignUp ? "At least 8 characters." : undefined}
          id="password"
          label="Password"
          name="password"
        />

        {isSignUp ? (
          <PasswordField
            autoComplete="new-password"
            id="confirmPassword"
            label="Confirm password"
            name="confirmPassword"
          />
        ) : null}

        {state?.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <button className="button button-ink button-full" disabled={pending || Boolean(state?.ok)} type="submit">
          {pending || state?.ok
            ? isSignUp
              ? "Creating account…"
              : "Signing in…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="auth-divider" role="separator">
        <span>or</span>
      </p>

      <GoogleSignInButton
        authEnabled={authEnabled}
        label={isSignUp ? "Continue with Google" : "Sign in with Google"}
        returnTo={returnTo}
      />

      <p className="auth-switch">
        {isSignUp ? (
          <>
            Already have an account? <Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link>
          </>
        ) : (
          <>
            New to Tripboard? <Link href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`}>Create an account</Link>
          </>
        )}
      </p>

      {!authEnabled ? (
        <p className="auth-guest">
          <Link href="/trips">Browse trips without an account</Link>
        </p>
      ) : null}

      <p className="form-footnote">
        By continuing, you agree to Tripboard saving the trips and places you add to your account.
      </p>
    </div>
  );
}
