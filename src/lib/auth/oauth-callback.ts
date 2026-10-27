import { safeInternalPath } from "./safe-next";

const FLOW_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const ERROR_CODE = /^[a-z0-9_]{1,64}$/i;

/** Speculative GETs must not consume the one-time PKCE code. */
export function isOAuthPrefetch(headers: {
  get(name: string): string | null;
}): boolean {
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return true;
  if (headers.get("next-router-prefetch")) return true;
  if (headers.get("next-router-segment-prefetch")) return true;
  if (headers.get("x-middleware-prefetch")) return true;
  return false;
}

/** Server exchange ignores the callback URL unless the flow id is passed in. */
export function pkceFlowId(raw: string | null | undefined): string | undefined {
  if (!raw || !FLOW_ID.test(raw)) return undefined;
  return raw;
}

export function sanitizeOAuthErrorCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim();
  if (!ERROR_CODE.test(code)) return null;
  return code;
}

export function sanitizeOAuthErrorDescription(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const text = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, 180);
}

/** Login URL after a callback that did not establish a session. */
export function loginErrorLocation(input: {
  error: string | null;
  description: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("error", sanitizeOAuthErrorCode(input.error) ?? "google_auth_failed");
  const description = sanitizeOAuthErrorDescription(input.description);
  if (description) params.set("error_description", description);
  return `/login?${params.toString()}`;
}

/**
 * A second callback hit (browser retry, prefetch that slipped through, or a
 * platform replay) must not call the token endpoint again when the first
 * exchange already created a session.
 */
export function shouldExchangeOAuthCode(input: {
  hasCode: boolean;
  prefetch: boolean;
  hasSession: boolean;
}): boolean {
  return input.hasCode && !input.prefetch && !input.hasSession;
}

export function oauthCallbackDestination(input: {
  hasSession: boolean;
  next: string | null;
}): string {
  if (input.hasSession) return safeInternalPath(input.next);
  return "/login";
}

/** Signed-in visitors should not stay on the auth screens; honour a safe `next`. */
export function signedInEntryRedirect(
  pathname: string,
  userId: string | null,
  next: string | null = null,
): string | null {
  if (!userId) return null;
  if (pathname === "/login" || pathname === "/signup") return safeInternalPath(next);
  return null;
}

/** Login URL for a signed-out visit to a protected page, keeping where it was headed. */
export function loginLocationFor(pathname: string, search: string): string {
  const target = safeInternalPath(`${pathname}${search}`);
  if (target === "/dashboard") return "/login";
  return `/login?${new URLSearchParams({ next: target }).toString()}`;
}

/** Supabase sends a specific `error_code` next to a generic `error`. */
export function oauthErrorCode(params: URLSearchParams): string | null {
  return params.get("error_code") || params.get("error");
}

/** Session refresh on the PKCE callback can drop the Set-Cookie on the redirect. */
export function proxySkipsSessionRefresh(pathname: string): boolean {
  return pathname === "/auth/callback";
}
