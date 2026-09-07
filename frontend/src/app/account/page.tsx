import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/account-panel";
import { AppHeader } from "@/components/app-header";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.restricted) redirect("/sign-in?restricted=1");

  const name = viewer.name?.trim() || "Traveller";
  const email = viewer.email ?? "";

  return (
    <main className="app-page">
      <AppHeader demo={viewer.demo} email={email} highlightNav={false} image={viewer.image} name={name} />
      <section className="account-shell">
        <p className="eyebrow">account</p>
        <h1>Your account.</h1>
        <p className="account-lede">This is how your name shows up on trips.</p>
        <AccountPanel demo={viewer.demo} email={email} image={viewer.image} name={name} />
      </section>
    </main>
  );
}
