/**
 * BuyMe session material — Bearer JWT (Ember Simple Auth), not cookies.
 * Same idea as maccabi-health MaccabiSession: export/import, never log the secret.
 */

export type BuyMeSession = {
  version: 1;
  /** JWT from localStorage ember_simple_auth-session.authenticated.token */
  token: string;
  authenticatedAt: string;
  /** Unix ms expiry from JWT `exp`, when decodable */
  expiresAtMs: number | null;
};

export function decodeJwtExpMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      const json = Buffer.from(part, "base64").toString("utf8");
      const payload = JSON.parse(json) as { exp?: number };
      return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }
}

export function createBuyMeSession(token: string, now = Date.now()): BuyMeSession {
  const trimmed = token.trim();
  if (!trimmed || trimmed.split(".").length < 2) {
    throw new Error("INVALID_BUYME_TOKEN");
  }
  return {
    version: 1,
    token: trimmed,
    authenticatedAt: new Date(now).toISOString(),
    expiresAtMs: decodeJwtExpMs(trimmed),
  };
}

export function isSessionExpired(session: BuyMeSession, now = Date.now()): boolean {
  if (session.expiresAtMs == null) return false;
  return session.expiresAtMs <= now;
}
