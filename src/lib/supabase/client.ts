import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./config";

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error("Supabase אינו מוגדר. השתמשו במצב הדמו או הגדירו משתני סביבה.");
  }
  return createBrowserClient(env.url, env.anonKey);
}
