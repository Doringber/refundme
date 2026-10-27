import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSecretKey } from "./secret";

/** Service-role client. Null when the server secret or project URL is missing. */
export function createAdminClient(): SupabaseClient | null {
  const key = getSecretKey();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
