import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getViewer, isNeonAuthConfigured } from "@/lib/auth";
import { safeReturnTo } from "@/lib/invitations";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = safeReturnTo(rawReturnTo);
  const viewer = await getViewer();
  if (viewer && !viewer.demo) redirect(returnTo);

  return (
    <AuthShell
      eyebrow="start here"
      lede="Save places, invite friends, and keep every trip on one map you can actually use."
      switchHref={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
      switchLabel="Sign in"
      title="Start with a shortlist."
    >
      <AuthForm authEnabled={isNeonAuthConfigured()} mode="sign-up" returnTo={returnTo} />
    </AuthShell>
  );
}
