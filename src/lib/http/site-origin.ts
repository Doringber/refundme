/** Public origin for links in emails and push payloads. Ignores junk values. */
export function siteOrigin(envValue: string | undefined, fallback: string): string {
  const raw = envValue?.trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}
