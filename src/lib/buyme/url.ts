const BUYME_HOSTS = new Set(["buyme.co.il", "www.buyme.co.il"]);

/** https URL on buyme.co.il only. Relative paths resolve against that origin. */
export function buyMeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim(), "https://buyme.co.il");
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!BUYME_HOSTS.has(url.hostname)) return null;
  if (url.username || url.password) return null;
  return url.toString();
}
