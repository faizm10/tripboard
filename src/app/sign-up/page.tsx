import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getViewer, isNeonAuthConfigured } from "@/lib/auth";
import { isSignInUnavailable } from "@/lib/auth-status";
import { safeReturnTo } from "@/lib/invitations";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = safeReturnTo(rawReturnTo);
  const [viewer, unavailable] = await Promise.all([getViewer(), isSignInUnavailable()]);
  if (viewer && !viewer.demo) redirect(returnTo);

  return (
    <AuthShell
      eyebrow="start here"
      lede="Save places, invite friends, and keep every trip on one map you can actually use."
      switchHref={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
      switchLabel="Sign in"
      title="Start with a shortlist."
    >
      <AuthForm authEnabled={isNeonAuthConfigured()} mode="sign-up" unavailable={unavailable} returnTo={returnTo} />
    </AuthShell>
  );
}
