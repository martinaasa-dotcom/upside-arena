import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { geistMono } from "./fonts";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ConsentBanner } from "@/components/ConsentBanner";
import { Analytics } from "@/components/Analytics";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Upside Arena",
    template: "%s · Upside Arena",
  },
  description:
    "A free weekly stock-picking game you play with friends. Play money only. Nothing real is ever at stake.",
  applicationName: "Upside Arena",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Upside Arena",
    statusBarStyle: "black-translucent",
  },
  /*
    Cache-busted on every icon change, because a favicon is one of the few
    things a browser will hold on to past a deploy and a stale one outlives
    the rebrand that replaced it.

    The Apple entry is deliberately the 180 square: iOS draws its own
    squircle over whatever it is given, so the file it is given must be
    full-bleed and must not be rounded already. See docs/brand/ARENA_MARK.md.
  */
  icons: {
    icon: [
      { url: "/icons/icon-16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-48.png?v=2", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico?v=2", sizes: "16x16 32x32" },
    ],
    shortcut: "/favicon.ico?v=2",
    apple: [{ url: "/icons/icon-180.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Upside Arena",
    title: "Upside Arena",
    description:
      "A free weekly stock-picking game you play with friends. Play money only.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Upside Arena",
    description:
      "A free weekly stock-picking game you play with friends. Play money only.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <ConsentBanner />
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
