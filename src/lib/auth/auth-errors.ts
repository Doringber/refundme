/**
 * Hebrew text for Supabase email/password errors. Supabase returns English
 * messages ("Invalid login credentials"); the stable part is `code`.
 */
const BY_CODE: Record<string, string> = {
  invalid_credentials: "האימייל או הסיסמה לא נכונים.",
  email_not_confirmed: "צריך לאשר את האימייל קודם. חפשו אצלכם את הודעת האישור.",
  user_already_exists: "כבר יש חשבון עם האימייל הזה. אפשר להתחבר.",
  email_exists: "כבר יש חשבון עם האימייל הזה. אפשר להתחבר.",
  weak_password: "הסיסמה חלשה מדי. בחרו לפחות 8 תווים, עם אותיות ומספרים.",
  email_address_invalid: "כתובת האימייל לא תקינה.",
  validation_failed: "בדקו את האימייל והסיסמה ונסו שוב.",
  over_request_rate_limit: "יותר מדי ניסיונות. חכו דקה ונסו שוב.",
  over_email_send_rate_limit: "נשלחו יותר מדי הודעות אימייל. חכו כמה דקות ונסו שוב.",
  signup_disabled: "הרשמה עם אימייל סגורה כרגע. אפשר להמשיך עם Google.",
  email_provider_disabled: "התחברות עם אימייל סגורה כרגע. אפשר להמשיך עם Google.",
  user_banned: "החשבון הזה חסום.",
};

const BY_MESSAGE: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials!],
  [/email not confirmed/i, BY_CODE.email_not_confirmed!],
  [/already registered|already exists/i, BY_CODE.user_already_exists!],
  [/password should be|weak password/i, BY_CODE.weak_password!],
  [/rate limit|too many/i, BY_CODE.over_request_rate_limit!],
  [/failed to fetch|network|load failed/i, "אין חיבור לשרת. בדקו את האינטרנט ונסו שוב."],
];

export function authErrorMessage(error: unknown, fallback = "ההתחברות נכשלה. נסו שוב."): string {
  if (!error || typeof error !== "object") return fallback;
  const record = error as { code?: unknown; name?: unknown; message?: unknown; status?: unknown };
  if (typeof record.code === "string" && BY_CODE[record.code]) return BY_CODE[record.code]!;
  if (record.name === "AuthRetryableFetchError") {
    return "אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.";
  }
  if (record.status === 429) return BY_CODE.over_request_rate_limit!;
  const message = typeof record.message === "string" ? record.message : "";
  for (const [pattern, text] of BY_MESSAGE) {
    if (pattern.test(message)) return text;
  }
  return fallback;
}
