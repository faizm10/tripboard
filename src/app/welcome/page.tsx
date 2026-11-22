import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { Logo } from "@/components/site/logo";
import { getViewer } from "@/lib/auth";
import { calendarDate } from "@/lib/trip-order";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.restricted) redirect("/sign-in?restricted=1");

  const firstName = viewer.name?.split(" ")[0] || "there";
  const headerStore = await headers();
  const today = calendarDate(headerStore.get("x-vercel-ip-timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone);

  return (
    <main className="welcome-page">
      <header className="form-page-header">
        <Logo />
      </header>
      <WelcomeFlow firstName={firstName} today={today} />
    </main>
  );
}
