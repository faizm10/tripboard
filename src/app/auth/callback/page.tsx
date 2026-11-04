import type { Metadata } from "next";
import { GoogleAuthCallback } from "@/components/google-auth-callback";

export const metadata: Metadata = { title: "Signing in" };

export default function GoogleAuthCallbackPage() {
  return <GoogleAuthCallback />;
}
