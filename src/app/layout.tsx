import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "@/components/ServiceWorker";
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
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180" }],
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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
