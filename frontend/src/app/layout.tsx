import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Kalam } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaRegister } from "@/components/pwa-register";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const handwritten = Kalam({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Tripboard — trips worth taking", template: "%s · Tripboard" },
  description: "Save travel spots, plan with friends, and turn them into a route.",
  applicationName: "Tripboard",
  appleWebApp: { capable: true, title: "Tripboard", statusBarStyle: "black-translucent" },
  icons: { icon: "/tripboard-mark.svg", apple: "/tripboard-mark.svg" },
};

export const viewport: Viewport = {
  themeColor: "#F4F0E8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${handwritten.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <AppProviders>
          <OfflineBanner />
          {children}
          <PwaRegister />
        </AppProviders>
      </body>
    </html>
  );
}
