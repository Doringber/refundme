/** New accounts and the settings fallback. Existing stored arrays are not rewritten. */
export const DEFAULT_REMINDER_DAYS = [30, 7, 1] as const;

/** Chips shown in Settings. 14 and 3 stay available for people who already used them. */
export const REMINDER_DAY_CHOICES = [30, 14, 7, 3, 1] as const;

export function normalizeReminderDays(days: readonly number[]): number[] {
  const cleaned = [
    ...new Set(
      days.filter(
        (day) => Number.isInteger(day) && day >= 1 && day <= 365,
      ),
    ),
  ].sort((a, b) => b - a);
  return cleaned.length > 0 ? cleaned : [...DEFAULT_REMINDER_DAYS];
}
