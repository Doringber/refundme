/**
 * Ember Simple Auth blob from BuyMe localStorage key
 * `ember_simple_auth-session`. Returns the bearer token, or null.
 */
export function readEmberSessionToken(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    const token = parsed?.authenticated?.token ?? parsed?.token;
    if (typeof token !== "string") return null;
    const trimmed = token.trim();
    if (trimmed.split(".").length < 2) return null;
    return trimmed;
  } catch {
    return null;
  }
}
