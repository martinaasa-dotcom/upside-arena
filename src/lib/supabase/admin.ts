import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, canWriteGame } from "@/lib/env";

/*
  The server's own client, holding the service role.

  This bypasses row level security, so it must never be constructed anywhere a
  browser can reach and must never take a symbol, a price or a quantity that
  came from a client without checking it first. Every use is in a server
  action or a route handler that has already established who the caller is.
*/

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (!canWriteGame) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The game engine cannot write without it."
    );
  }

  cached ??= createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
