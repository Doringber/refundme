"use client";

import Link from "next/link";
import { CreditOrb } from "@/components/orb/credit-orb";
import { NeonCardStack } from "@/components/ui/neon-card-stack";
import { LoadingBlock } from "@/components/ui/loading";
import { formatIls, isSpendable } from "@/lib/calculations";
import { useAppData } from "@/lib/app-data/context";
import { headlineFromApp } from "@/lib/home-headline";

export default function DashboardPage() {
  const app = useAppData();

  if (!app.ready) return <LoadingBlock label="טוען את הזיכויים…" />;

  const { summary, profile } = app;
  const active = summary.vouchers.filter(isSpendable);
  const hasCredits = summary.totalActiveCreditAgorot > 0 || active.length > 0;
  const merchants = summary.merchantBreakdown.slice(0, 5);
  const recent = [
    ...summary.recentActivity.slice(0, 6),
  ];
  const showStack = merchants.length > 0;
  const displayNameFallback =
    app.user?.user_metadata?.full_name ||
    app.user?.user_metadata?.name ||
    app.user?.email?.split("@")[0] ||
    null;
  const title = headlineFromApp({
    profile,
    summary,
    displayNameFallback:
      typeof displayNameFallback === "string" ? displayNameFallback : null,
  });

  return (
    <div className="space-y-5">
      {/* Hero balance + orb */}
      <section className="relative overflow-hidden rounded-[2rem] px-1 pt-2">
        <h1 className="chrome-ink font-display text-2xl leading-snug tracking-tight md:text-3xl">
          {title}
        </h1>
        <p className="chrome-muted mt-4 text-sm font-bold">יתרה כוללת</p>
        <p className="chrome-ink font-display mt-1 text-5xl tracking-tight md:text-6xl">
          {formatIls(summary.totalActiveCreditAgorot)}
        </p>
        <p className="chrome-faint mt-1 text-xs font-semibold">
          לפי הדיווח שלך
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/vouchers/new" className="btn-primary px-6 py-2.5 text-sm">
            צילום זיכוי
          </Link>
          <Link href="/vouchers" className="btn-secondary px-6 py-2.5 text-sm">
            כל הזיכויים
          </Link>
        </div>

        <div
          className={`mt-6 grid items-center gap-4 ${
            showStack
              ? "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
              : ""
          }`}
        >
          <CreditOrb
            totalAgorot={summary.totalActiveCreditAgorot}
            nearestExpiring={summary.nearestExpiring}
            daysUntilNearestExpiry={summary.daysUntilNearestExpiry}
            orbScaleAgorot={profile.orbScaleAgorot}
            gainAgorot={app.lastGainAgorot}
            onGainShown={() => app.clearGain()}
            emptyHref="/vouchers/new"
            className="!mx-0"
          />

          {showStack && <NeonCardStack merchants={merchants} />}
        </div>
      </section>

      {/* Bottom sheet — dark neon glass, matching the home palette */}
      <section className="sheet-panel neon-sheet-enter -mx-4 px-4 pb-6 pt-5 md:mx-0 md:rounded-[2rem] md:px-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="sheet-title font-display text-xl">
            {hasCredits ? "פעילות אחרונה" : "התחילו כאן"}
          </h2>
          {hasCredits && (
            <Link href="/activity" className="sheet-link text-sm font-extrabold">
              הכל
            </Link>
          )}
        </div>

        {!hasCredits ? (
          <div className="space-y-4 py-2 text-center">
            <p className="sheet-muted text-sm font-semibold">
              עדיין אין זיכויים. צלמו שובר — והיתרה תופיע בעיגול.
            </p>
            <Link
              href="/vouchers/new"
              className="btn-primary inline-flex px-7 py-3 text-sm"
            >
              הוספת זיכוי ראשון
            </Link>
          </div>
        ) : recent.length > 0 ? (
          <ul className="space-y-2">
            {recent.map((a) => (
              <li key={a.id}>
                {a.voucherId ? (
                  <Link
                    href={`/vouchers/${a.voucherId}`}
                    className="sheet-row flex items-center justify-between gap-3 rounded-2xl px-3 py-3"
                  >
                    <div className="min-w-0 text-right">
                      <p className="sheet-title truncate text-sm font-extrabold">
                        {a.summaryHe}
                      </p>
                      <p className="sheet-muted text-xs font-semibold">
                        {new Date(a.createdAt).toLocaleString("he-IL")}
                      </p>
                    </div>
                    <span className="sheet-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">
                      ₪
                    </span>
                  </Link>
                ) : (
                  <div className="sheet-row rounded-2xl px-3 py-3 text-sm font-extrabold">
                    {a.summaryHe}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {active.slice(0, 6).map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vouchers/${v.id}`}
                  className="sheet-row flex items-center justify-between gap-3 rounded-2xl px-3 py-3"
                >
                  <div className="min-w-0 text-right">
                    <p className="sheet-title truncate text-sm font-extrabold">
                      {v.merchantName}
                    </p>
                    <p className="sheet-muted text-xs font-semibold">
                      {v.expiryDate ? `תוקף ${v.expiryDate}` : "תוקף לא אומת"}
                    </p>
                  </div>
                  <p className="sheet-title font-display text-base">
                    {formatIls(v.remainingAmountAgorot)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
