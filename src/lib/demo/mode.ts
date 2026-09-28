import { DEMO_COOKIE } from "../constants";
import { isSupabaseConfigured } from "../supabase/config";

export function isDemoModeFromCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return !isSupabaseConfigured();
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${DEMO_COOKIE}=`));
  if (match) return match.split("=")[1] === "1";
  return !isSupabaseConfigured();
}

export function shouldPreferDemo(): boolean {
  return !isSupabaseConfigured();
}
