/**
 * Supports classic anon JWT keys and newer Supabase publishable keys
 * (`sb_publishable_...`). Prefer NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 */
export function getPublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Server-only secret. Supports classic service_role JWT and newer
 * `sb_secret_...` keys. Never expose to the browser.
 */
export function getSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
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
