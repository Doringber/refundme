/**
 * Public Supabase helpers — safe to import from client and middleware.
 * Never put secret/service_role keys in this file (they get inlined into
 * Edge/client bundles and fail Netlify secrets scanning).
 *
 * Supports classic anon JWT keys and newer Supabase publishable keys
 * (`sb_publishable_...`). Prefer NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 */

export function getPublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getPublishableKey());
}

export function getSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getPublishableKey();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
