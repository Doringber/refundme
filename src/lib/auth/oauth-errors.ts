import { sanitizeOAuthErrorDescription } from "./oauth-callback";

const MESSAGES: Record<string, string> = {
  google_auth_failed: "התחברות עם Google נכשלה. נסו שוב או השתמשו באימייל.",
  access_denied: "ההתחברות עם Google בוטלה.",
};

export function oauthErrorMessage(
  code: string | null,
  description?: string | null,
): string | null {
  if (code && MESSAGES[code]) return MESSAGES[code];
  const safeDescription = sanitizeOAuthErrorDescription(description);
  if (safeDescription) return safeDescription;
  if (code) return "ההתחברות נכשלה";
  return null;
}
