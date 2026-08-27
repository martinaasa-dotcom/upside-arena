import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { geistMono } from "./fonts";
import { AmbientDither } from "@/components/AmbientDither";
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
    iOS Safari otherwise autolinks strings that look like phone numbers,
    addresses or emails, wrapping them in an <a> after first paint. That is
    a layout shift on a page whose figures already look like numbers, and
    it is a delayed paint on older WebKit. Lab has the same three flags.
  */
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  /*
    Cache-busted on every icon change, because a favicon is one of the few
    things a browser will hold on to past a deploy and a stale one outlives
    the rebrand that replaced it.

    Three files in the document, not a raster of every size. Chrome will
    download every <link rel="icon"> it sees before the hero font, and the
    16/32/48/192 PNGs already live in the manifest for install. The Apple
    entry is the conventional path so iOS does not fetch this one and then
    also poke `/apple-touch-icon.png` on its own. It is the 180 square:
    iOS draws its own squircle over whatever it is given, so the file it
    is given must be full-bleed and must not be rounded already. See
    docs/brand/ARENA_MARK.md.
  */
  icons: {
    icon: [
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon.ico?v=3", sizes: "16x16 32x32" },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: [
      {
        url: "/apple-touch-icon.png?v=3",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Upside Arena",
    title: "Upside Arena",
    description:
      "A free weekly stock-picking game you play with friends. Play money only.",
    images: [{ url: "/og.png?v=3", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Upside Arena",
    description:
      "A free weekly stock-picking game you play with friends. Play money only.",
    images: ["/og.png?v=3"],
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
        <AmbientDither />
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
