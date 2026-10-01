"use client";

import Link from "next/link";
import { CreditOrb } from "@/components/orb/credit-orb";
import { LoadingBlock } from "@/components/ui/loading";
import { formatIls, isSpendable } from "@/lib/calculations";
import { useAppData } from "@/lib/app-data/context";

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

  return (
    <div className="space-y-5">
      {/* Hero balance + orb */}
      <section className="relative overflow-hidden rounded-[2rem] px-1 pt-2">
        <p className="text-sm font-bold text-white/50">יתרה כוללת</p>
        <p className="font-display mt-1 text-5xl tracking-tight text-white md:text-6xl">
          {formatIls(summary.totalActiveCreditAgorot)}
        </p>
        <p className="mt-1 text-xs font-semibold text-white/40">
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

        <div className="mt-6 grid items-center gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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

          {merchants.length > 0 ? (
            <div className="neon-card-stack neon-stack-enter" aria-label="לפי חנות">
              {merchants.map((m) => (
                <Link
                  key={m.merchantName}
                  href={`/vouchers?merchant=${encodeURIComponent(m.merchantName)}`}
                  className="neon-stack-card block"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold">{m.merchantName}</p>
                      <p className="text-xs font-bold opacity-70">{m.count} מסמכים</p>
                    </div>
                    <p className="font-display text-lg">{formatIls(m.totalAgorot)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="neon-card-stack neon-stack-enter" aria-hidden>
              <div className="neon-stack-card">צילום</div>
              <div className="neon-stack-card">אישור</div>
              <div className="neon-stack-card">מעקב</div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom sheet style list */}
      <section className="sheet-light neon-sheet-enter -mx-4 px-4 pb-6 pt-5 md:mx-0 md:rounded-[2rem] md:px-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-[#12141a]">
            {hasCredits ? "פעילות אחרונה" : "התחילו כאן"}
          </h2>
          {hasCredits && (
            <Link href="/activity" className="text-sm font-extrabold text-[#12141a]/80">
              הכל
            </Link>
          )}
        </div>

        {!hasCredits ? (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm font-semibold text-[#5d6670]">
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
                    className="flex items-center justify-between gap-3 rounded-2xl bg-black/[0.03] px-3 py-3"
                  >
                    <div className="min-w-0 text-right">
                      <p className="truncate text-sm font-extrabold text-[#12141a]">
                        {a.summaryHe}
                      </p>
                      <p className="text-xs font-semibold text-[#5d6670]">
                        {new Date(a.createdAt).toLocaleString("he-IL")}
                      </p>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12141a] text-sm font-extrabold text-white">
                      ₪
                    </span>
                  </Link>
                ) : (
                  <div className="rounded-2xl bg-black/[0.03] px-3 py-3 text-sm font-extrabold text-[#12141a]">
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
                  className="flex items-center justify-between gap-3 rounded-2xl bg-black/[0.03] px-3 py-3"
                >
                  <div className="min-w-0 text-right">
                    <p className="truncate text-sm font-extrabold text-[#12141a]">
                      {v.merchantName}
                    </p>
                    <p className="text-xs font-semibold text-[#5d6670]">
                      {v.expiryDate ? `תוקף ${v.expiryDate}` : "תוקף לא אומת"}
                    </p>
                  </div>
                  <p className="font-display text-base text-[#12141a]">
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
