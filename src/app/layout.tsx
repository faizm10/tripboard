import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaRegister } from "@/components/pwa-register";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

const sans = Host_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
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
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={sans.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
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
