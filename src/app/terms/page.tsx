import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = { title: "Terms", description: "The ground rules for using Tripboard." };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="terms" title="Terms of use." updated="November 12, 2026">
      <p>By using Tripboard you agree to these terms. They&rsquo;re short on purpose.</p>

      <h2>Using Tripboard</h2>
      <ul>
        <li>Tripboard is free to use and is provided as is. Features can change, and the service may sometimes be unavailable.</li>
        <li>You&rsquo;re responsible for your account and for what you and the people you invite add to your trips.</li>
        <li>Don&rsquo;t use Tripboard to break the law, to harass anyone, or to overload or attack the service.</li>
      </ul>

      <h2>Your content</h2>
      <p>What you put on your boards stays yours. You let Tripboard store and show it to you and the people you share a trip with, which is what the app needs to work.</p>

      <h2>Plans, places and AI suggestions</h2>
      <p>Opening hours, prices, routes, weather and the trip assistant&rsquo;s suggestions come from other services and from AI models, and they can be wrong or out of date. Check anything important, like bookings, visas and transport times, with the source before you rely on it.</p>

      <h2>Ending things</h2>
      <p>You can stop using Tripboard at any time and ask for your account to be deleted. Accounts that break these terms may be suspended.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, Tripboard isn&rsquo;t liable for losses that come from using it, such as missed connections or bookings made from its suggestions.</p>

      <h2>Contact</h2>
      <p>Questions go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. How your data is handled is covered in the <Link href="/privacy">privacy policy</Link>.</p>
    </LegalPage>
  );
}
