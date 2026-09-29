const MESSAGES: Record<string, string> = {
  google_auth_failed: "התחברות עם Google נכשלה. נסו שוב או השתמשו באימייל.",
};

export function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "ההתחברות נכשלה";
}
