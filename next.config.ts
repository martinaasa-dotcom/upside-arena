import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  /*
    yahoo-finance2 is a CommonJS package that reads its own files at runtime.
    Bundling it breaks that, so it stays external and is required normally on
    the server. Upside Lab does the same.
  */
  serverExternalPackages: ["yahoo-finance2"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: STATIC_SECURITY_HEADERS,
      },
      {
        // A cached service worker outlives the app it was meant to serve.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // A player's own rooms have nothing to offer a search engine.
        source: "/(home|trade|profile|onboarding)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
