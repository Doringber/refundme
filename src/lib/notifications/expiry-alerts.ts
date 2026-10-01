import { daysUntil, formatIls, isSpendable } from "@/lib/calculations";
import { APP_NAME } from "@/lib/constants";
import type { Voucher } from "@/lib/types";

export const BROWSER_NOTIFY_STORAGE_KEY = "zikuy_browser_notifications";
export const NOTIFY_DEDUPE_STORAGE_KEY = "zikuy_expiry_notify_dedupe_v1";

export type ExpiryAlertCandidate = {
  voucher: Voucher;
  daysLeft: number;
  /** Reminder threshold that matched (0 = expiry day / overdue) */
  threshold: number;
  title: string;
  body: string;
};

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

export function isBrowserNotifyEnabled(): boolean {
  return readStorage(BROWSER_NOTIFY_STORAGE_KEY) === "1";
}

export function setBrowserNotifyEnabled(enabled: boolean): void {
  writeStorage(BROWSER_NOTIFY_STORAGE_KEY, enabled ? "1" : "0");
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function todayKey(today = new Date()): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type DedupeMap = Record<string, string>;

function readDedupe(): DedupeMap {
  const raw = readStorage(NOTIFY_DEDUPE_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as DedupeMap;
  } catch {
    /* ignore */
  }
  return {};
}

function writeDedupe(map: DedupeMap): void {
  writeStorage(NOTIFY_DEDUPE_STORAGE_KEY, JSON.stringify(map));
}

export function dedupeKey(voucherId: string, threshold: number): string {
  return `${voucherId}:${threshold}`;
}

export function wasAlreadyNotified(
  voucherId: string,
  threshold: number,
  today = new Date(),
): boolean {
  const map = readDedupe();
  return map[dedupeKey(voucherId, threshold)] === todayKey(today);
}

export function markNotified(
  voucherId: string,
  threshold: number,
  today = new Date(),
): void {
  const map = readDedupe();
  map[dedupeKey(voucherId, threshold)] = todayKey(today);
  // Prune entries older than ~60 days of keys growth — keep last 200
  const entries = Object.entries(map);
  if (entries.length > 200) {
    const trimmed = Object.fromEntries(entries.slice(-200));
    writeDedupe(trimmed);
    return;
  }
  writeDedupe(map);
}

/**
 * Pick the tightest matching reminder threshold for a voucher.
 * Uses confirmed expiry only; spendable vouchers with remaining balance.
 */
export function matchingReminderThreshold(
  daysLeft: number,
  reminderDays: number[],
): number | null {
  if (!Number.isFinite(daysLeft)) return null;
  if (daysLeft < 0) return 0;
  if (daysLeft === 0) return 0;
  const days = [...new Set(reminderDays)]
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
  // Fire when we've reached or passed a threshold (daysLeft <= threshold)
  // but only once per threshold via dedupe — pick the smallest threshold
  // that still covers daysLeft (most urgent match).
  const matches = days.filter((d) => daysLeft <= d);
  if (!matches.length) return null;
  return Math.min(...matches);
}

export function collectExpiryAlerts(
  vouchers: Voucher[],
  reminderDays: number[],
  today = new Date(),
): ExpiryAlertCandidate[] {
  const out: ExpiryAlertCandidate[] = [];

  for (const voucher of vouchers) {
    if (!isSpendable(voucher)) continue;
    if (voucher.expiryConfidence !== "confirmed" || !voucher.expiryDate) {
      continue;
    }
    const daysLeft = daysUntil(voucher.expiryDate, today);
    if (daysLeft === null) continue;

    const threshold = matchingReminderThreshold(daysLeft, reminderDays);
    if (threshold === null) continue;
    if (wasAlreadyNotified(voucher.id, threshold, today)) continue;

    const amount = formatIls(voucher.remainingAmountAgorot);
    const title =
      daysLeft < 0
        ? `פג תוקף — ${voucher.merchantName}`
        : daysLeft === 0
          ? `פקיעה היום — ${voucher.merchantName}`
          : `תזכורת זיכוי — ${voucher.merchantName}`;

    const body =
      daysLeft < 0
        ? `${amount} פג לפני ${Math.abs(daysLeft)} ימים · ${APP_NAME}`
        : daysLeft === 0
          ? `${amount} פג היום · ${APP_NAME}`
          : `${amount} · עוד ${daysLeft} ימים עד הפקיעה · ${APP_NAME}`;

    out.push({ voucher, daysLeft, threshold, title, body });
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function showExpiryNotification(
  alert: ExpiryAlertCandidate,
): boolean {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }
  if (Notification.permission !== "granted") return false;

  try {
    const n = new Notification(alert.title, {
      body: alert.body,
      tag: `zikuy-expiry-${alert.voucher.id}-${alert.threshold}`,
      lang: "he",
      dir: "rtl",
    });
    n.onclick = () => {
      window.focus();
      // Notification handlers run outside React; full navigation is intentional.
      window.open(`/vouchers/${alert.voucher.id}/present`, "_self");
      n.close();
    };
    markNotified(alert.voucher.id, alert.threshold);
    return true;
  } catch {
    return false;
  }
}

export function runExpiryNotificationPass(
  vouchers: Voucher[],
  reminderDays: number[],
  today = new Date(),
): number {
  if (!isBrowserNotifyEnabled()) return 0;
  if (notificationPermission() !== "granted") return 0;

  const alerts = collectExpiryAlerts(vouchers, reminderDays, today);
  let shown = 0;
  for (const alert of alerts) {
    if (showExpiryNotification(alert)) shown += 1;
  }
  return shown;
}
