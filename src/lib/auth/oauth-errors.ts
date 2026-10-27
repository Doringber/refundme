import { sanitizeOAuthErrorDescription } from "./oauth-callback";

const MESSAGES: Record<string, string> = {
  google_auth_failed: "התחברות עם Google נכשלה. נסו שוב או השתמשו באימייל.",
  access_denied: "ההתחברות עם Google בוטלה.",
  server_error: "שרת ההתחברות לא הגיב. נסו שוב בעוד רגע.",
  temporarily_unavailable: "שרת ההתחברות לא זמין כרגע. נסו שוב בעוד רגע.",
  otp_expired: "קישור האישור פג תוקף. התחברו שוב כדי לקבל קישור חדש.",
  bad_oauth_state: "ההתחברות התחילה בלשונית או בדפדפן אחר. נסו שוב מכאן.",
  bad_oauth_callback: "ההתחברות התחילה בלשונית או בדפדפן אחר. נסו שוב מכאן.",
  flow_state_not_found: "ההתחברות התחילה בלשונית או בדפדפן אחר. נסו שוב מכאן.",
  flow_state_expired: "עבר יותר מדי זמן מתחילת ההתחברות. נסו שוב.",
  provider_disabled: "התחברות עם Google סגורה כרגע. אפשר להשתמש באימייל.",
  signup_disabled: "הרשמה של משתמשים חדשים סגורה כרגע.",
  user_banned: "החשבון הזה חסום.",
};

/**
 * Anyone can craft a /login?error_description= link, so only plain
 * provider-style English is echoed: no markup, links or phone numbers.
 */
function displayableDetail(description: string | null | undefined): string | null {
  const text = sanitizeOAuthErrorDescription(description);
  if (!text || text.length > 120) return null;
  if (!/^[A-Za-z0-9 .,:;'()_-]+$/.test(text)) return null;
  if (/https?|www\.|\.(com|net|io|il)\b|\d{4,}/i.test(text)) return null;
  return text;
}

/**
 * Hebrew text for `?error=` on the login page. Provider descriptions are
 * English, so an unknown code keeps the description only as detail.
 */
export function oauthErrorMessage(
  code: string | null,
  description?: string | null,
): string | null {
  if (code && MESSAGES[code]) return MESSAGES[code];
  const detail = displayableDetail(description);
  if (detail) return `ההתחברות נכשלה (${detail}). נסו שוב.`;
  if (description && sanitizeOAuthErrorDescription(description)) return "ההתחברות נכשלה. נסו שוב.";
  if (code) return "ההתחברות נכשלה. נסו שוב.";
  return null;
}
