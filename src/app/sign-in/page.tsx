import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getViewer, isNeonAuthConfigured } from "@/lib/auth";
import { safeReturnTo } from "@/lib/invitations";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; restricted?: string }> }) {
  const { returnTo: rawReturnTo, restricted } = await searchParams;
  const returnTo = safeReturnTo(rawReturnTo);
  const viewer = await getViewer();
  if (viewer && !viewer.demo && !viewer.restricted) redirect(returnTo);

  return (
    <AuthShell
      eyebrow="your boards"
      lede="Pick up a shared map, add the next place, and keep the trip in one shortlist."
      switchAsButton
      switchHref={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`}
      switchLabel="Create account"
      title="Your map is waiting."
    >
      <AuthForm authEnabled={isNeonAuthConfigured()} mode="sign-in" restricted={restricted === "1"} returnTo={returnTo} />
    </AuthShell>
  );
}
