import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
      Everything except static assets and image files. The service worker and
      manifest are handled inside updateSession.
    */
    "/((?!_next/static|_next/image|favicon.png|sw.js|manifest.webmanifest|icons/|og.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
