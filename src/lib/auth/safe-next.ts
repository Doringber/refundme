const FALLBACK = "/dashboard";

/**
 * Keep OAuth `next` on this site. Reject protocol-relative URLs, backslashes,
 * and control characters that can turn a redirect into an open redirect.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = FALLBACK,
): string {
  if (!raw) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.startsWith("/\\")
  ) {
    return fallback;
  }
  if (decoded.includes("\\") || /[\u0000-\u001F\u007F]/.test(decoded)) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(decoded, "https://zikuy.local");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://zikuy.local") return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
