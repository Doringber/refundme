import "server-only";

/**
 * Server-only secret. Supports classic service_role JWT and newer
 * `sb_secret_...` keys. Never import this module from client or proxy code.
 */
export function getSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
