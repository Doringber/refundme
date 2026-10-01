import type { DashboardSummary, UserProfile, Voucher } from "./types";
import { formatIls } from "./calculations";

export type HeadlineContext = {
  displayName: string | null;
  totalAgorot: number;
  voucherCount: number;
  nearestExpiring: Voucher | null;
  daysUntilNearestExpiry: number | null;
  now?: Date;
};

function firstName(displayName: string | null): string | null {
  if (!displayName) return null;
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  // "Dor Ingber" / "דור אינגבר" / email local-part
  const part = trimmed.split(/[\s@._-]+/)[0] ?? trimmed;
  return part.slice(0, 18) || null;
}

function dayBucket(now: Date): number {
  // Stable per local calendar day — funny, not twitchy
  const y = now.getFullYear();
  const start = new Date(y, 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function hourBand(now: Date): "morning" | "afternoon" | "evening" | "night" {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!;
}

/**
 * Funny, personal, dynamic home headline — never the static brand name.
 */
export function homeHeadline(ctx: HeadlineContext): string {
  const now = ctx.now ?? new Date();
  const name = firstName(ctx.displayName);
  const you = name ?? "חבר";
  const band = hourBand(now);
  const seed =
    dayBucket(now) * 17 +
    (ctx.voucherCount + 1) * 3 +
    Math.floor(ctx.totalAgorot / 1000);

  const emptyPool = [
    `${you}, הכיס של הזיכויים ריק — בוא נצלם משהו`,
    `${you}, אין עדיין זיכויים. הזדמנות להתחיל בדרמה קטנה`,
    `היי ${you} — פה יהיו הזיכויים שלך. כרגע רק אבק כוכבים`,
    `${you}, בלי זיכויים המסך הזה מרגיש קצת בודד`,
  ];

  if (ctx.totalAgorot <= 0 && ctx.voucherCount <= 0) {
    return pick(emptyPool, seed);
  }

  const days = ctx.daysUntilNearestExpiry;
  const merchant = ctx.nearestExpiring?.merchantName;

  if (days !== null && days <= 3 && merchant) {
    const urgent = [
      `${you}, ${merchant} נושף בעורף — עוד ${days < 0 ? "פג" : days === 0 ? "היום" : `${days} ימים`}`,
      `אזעקה קטנה ל${you}: משהו מ־${merchant} עומד להיעלם`,
      `${you}, אל תיתן לזיכוי ב־${merchant} לברוח בלי להגיד שלום`,
    ];
    return pick(urgent, seed);
  }

  if (days !== null && days <= 14 && merchant) {
    const soon = [
      `${you}, יש זיכוי שמתקרב לפקיעה — ${merchant} מחכה`,
      `תזכורת ידידותית ל${you}: ${merchant} לא יהיה לנצח`,
      `${you}, שעון התוקף מתקתק ליד ${merchant}`,
    ];
    return pick(soon, seed);
  }

  const amount = formatIls(ctx.totalAgorot);
  const richPool = [
    `${you}, אתה יושב על ${amount} של זיכויים. לא רע`,
    `היי ${you} — יש פה ${amount} שמחכים לצאת לקניות`,
    `${you}, היתרה אומרת ${amount}. הארנק הדיגיטלי מחייך`,
    `${amount} על השם שלך, ${you}. תשתמש באחריות (או לא)`,
  ];

  const timePool: Record<typeof band, string[]> = {
    morning: [
      `בוקר טוב ${you} — הזיכויים כבר ערים`,
      `${you}, קפה וזיכויים. סדר עדיפויות נכון`,
      `בוקר של ${you}: יש מה לממש היום`,
    ],
    afternoon: [
      `${you}, צהריים טובים לציד זיכויים`,
      `היי ${you} — הפסקה קצרה לבדוק מה נשאר`,
      `${you}, אחר הצהריים הזה שייך לקניות חכמות`,
    ],
    evening: [
      `ערב טוב ${you} — הזיכויים לא הולכים לישון מוקדם`,
      `${you}, סוף יום ו־${amount} עדיין מחכים`,
      `היי ${you}, ערב מצוין לבזבז… זיכוי`,
    ],
    night: [
      `${you}, גם בלילה הזיכויים שלך לא נחים`,
      `לילה טוב? רגע, ${you} — קודם בדקת יתרה`,
      `${you}, שעת לילה ו־${amount} עדיין על המשמר`,
    ],
  };

  // Mix time-of-day flavor with balance flavor
  const pool = seed % 2 === 0 ? timePool[band] : richPool;
  return pick(pool, seed + band.length);
}

export function headlineFromApp(opts: {
  profile: UserProfile;
  summary: DashboardSummary;
  displayNameFallback?: string | null;
  now?: Date;
}): string {
  return homeHeadline({
    displayName: opts.profile.displayName ?? opts.displayNameFallback ?? null,
    totalAgorot: opts.summary.totalActiveCreditAgorot,
    voucherCount: opts.summary.vouchers.length,
    nearestExpiring: opts.summary.nearestExpiring,
    daysUntilNearestExpiry: opts.summary.daysUntilNearestExpiry,
    now: opts.now,
  });
}
