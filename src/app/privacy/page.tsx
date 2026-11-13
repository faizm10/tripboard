import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = { title: "Privacy", description: "What Tripboard stores about you, who it shares it with, and how to delete it." };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="privacy" title="Privacy." updated="November 12, 2026">
      <p>Tripboard is a small, independent trip planner. This page explains, in plain words, what it keeps about you and why.</p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Your account.</strong> When you sign in with Google or email we keep your name, email address and profile photo, plus the session that keeps you signed in.</li>
        <li><strong>Your trips.</strong> Everything you add to a board: places, day plans, notes, the agenda, bookings, expenses, and who you invited.</li>
        <li><strong>Assistant chats.</strong> Conversations with the trip assistant are saved to your account so you can come back to them. You can delete them from the assistant&rsquo;s history.</li>
        <li><strong>Your own AI keys</strong>, if you add them. They are encrypted before they are stored and are only used to answer your own assistant requests.</li>
      </ul>
      <p>We don&rsquo;t sell your data or show ads. To see which pages get used, Tripboard counts page views with Vercel Web Analytics, which sets no cookies and doesn&rsquo;t identify you. The only cookies are the ones that keep you signed in.</p>

      <h2>Who else sees it</h2>
      <p>Tripboard relies on a few services to work. Each gets only what it needs:</p>
      <ul>
        <li><strong>Vercel</strong> hosts the app and <strong>Neon</strong> hosts the database and sign-in.</li>
        <li><strong>Google</strong> handles &ldquo;Sign in with Google&rdquo;. Tripboard receives only your name, email and photo.</li>
        <li><strong>Google Maps Platform, Mapbox and Foursquare</strong> receive place searches and map locations to show maps, photos, routes and transit times.</li>
        <li><strong>Open-Meteo</strong> receives a trip&rsquo;s location and dates to show the weather.</li>
        <li><strong>AI model providers</strong> (through OpenRouter, or OpenAI, Anthropic or Google when you use your own key) receive your message and a summary of the trip you&rsquo;re asking about, so they can answer.</li>
      </ul>
      <p>People you invite to a trip can see and edit that trip.</p>

      <h2>Deleting your data</h2>
      <p>You can delete trips and chats yourself at any time. To delete your whole account and everything in it, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and it will be removed within 30 days.</p>

      <h2>Changes and contact</h2>
      <p>If this policy changes, the date at the top will change too. Questions go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also the <Link href="/terms">terms of use</Link>.</p>
    </LegalPage>
  );
}
