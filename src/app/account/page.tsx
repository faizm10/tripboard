import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountAiKeys } from "@/components/account/account-ai-keys";
import { AccountAssistant } from "@/components/account/account-assistant";
import { AccountPanel } from "@/components/account/account-panel";
import { AppHeader } from "@/components/site/app-header";
import { SiteFooter } from "@/components/site/site-footer";
import { listApiKeys } from "@/lib/assistant/api-keys";
import { getSaveConversations, getUsageSummary, listConversations } from "@/lib/assistant/store";
import { getViewer } from "@/lib/auth";
import { aiKeysSecret } from "@/lib/env";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.restricted) redirect("/sign-in?restricted=1");

  const name = viewer.name?.trim() || "Traveller";
  const email = viewer.email ?? "";
  const [saving, usage, conversations, apiKeys] = viewer.demo
    ? [false, await getUsageSummary(viewer.id), [], []]
    : await Promise.all([getSaveConversations(viewer.id), getUsageSummary(viewer.id), listConversations(viewer.id), listApiKeys(viewer.id)]);

  return (
    <main className="app-page">
      <AppHeader demo={viewer.demo} email={email} highlightNav={false} image={viewer.image} name={name} />
      <section className="account-shell">
        <p className="eyebrow">account</p>
        <h1>Your account.</h1>
        <p className="account-lede">This is how your name shows up on trips.</p>
        <AccountPanel demo={viewer.demo} email={email} image={viewer.image} name={name} />
        <AccountAssistant conversations={conversations} demo={viewer.demo} saving={saving} usage={usage} />
        <AccountAiKeys available={!viewer.demo && Boolean(aiKeysSecret())} demo={viewer.demo} keys={apiKeys} />
      </section>
      <SiteFooter />
    </main>
  );
}
