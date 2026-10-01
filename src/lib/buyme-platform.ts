export type BuyMeClientPlatform = "ios" | "android" | "desktop";

/** Best-effort UA sniff for BuyMe import instructions (not security-sensitive). */
export function detectBuyMeClientPlatform(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
): BuyMeClientPlatform {
  const v = ua || "";
  if (/Android/i.test(v)) return "android";
  // iPadOS 13+ may report as Mac — treat touch Macs as iOS for Shortcut UX.
  if (/iPhone|iPad|iPod/i.test(v)) return "ios";
  if (
    typeof navigator !== "undefined" &&
    /Macintosh/i.test(v) &&
    Number(navigator.maxTouchPoints) > 1
  ) {
    return "ios";
  }
  return "desktop";
}
