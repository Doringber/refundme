"use client";

import Link from "next/link";
import { CreditOrb } from "@/components/orb/credit-orb";
import { LoadingBlock } from "@/components/ui/loading";
import { VoucherCard } from "@/components/vouchers/voucher-card";
import { daysUntil, formatIls, isSpendable } from "@/lib/calculations";
import { useAppData } from "@/lib/app-data/context";

export default function DashboardPage() {
  const app = useAppData();

  if (!app.ready) return <LoadingBlock label="טוען את הזיכויים…" />;

  const { summary, profile } = app;
  const hasCredits = summary.totalActiveCreditAgorot > 0 || summary.vouchers.length > 0;
  const timeline = summary.vouchers
    .filter(isSpendable)
    .filter((v) => v.expiryConfidence === "confirmed" && v.expiryDate)
    .map((v) => ({ voucher: v, days: daysUntil(v.expiryDate)! }))
    .sort((a, b) => a.days - b.days);

  if (!hasCredits) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6 text-center">
        <CreditOrb
          totalAgorot={0}
          nearestExpiring={null}
          daysUntilNearestExpiry={null}
          orbScaleAgorot={profile.orbScaleAgorot}
          emptyHref="/vouchers/new"
        />
        <div className="space-y-2">
          <h1 className="font-display text-2xl text-forest">
            הוסיפו את הזיכוי הראשון
          </h1>
          <p className="text-sm font-semibold leading-relaxed text-eggplant">
            צלמו שובר או תעודת זיכוי, אשרו את הפרטים — והיתרה תופיע כאן.
          </p>
        </div>
        <Link
          href="/vouchers/new"
          className="btn-primary w-full max-w-xs py-3.5 text-base"
        >
          צילום זיכוי
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CreditOrb
        totalAgorot={summary.totalActiveCreditAgorot}
        nearestExpiring={summary.nearestExpiring}
        daysUntilNearestExpiry={summary.daysUntilNearestExpiry}
        orbScaleAgorot={profile.orbScaleAgorot}
        gainAgorot={app.lastGainAgorot}
        onGainShown={() => app.clearGain()}
      />

      {summary.merchantBreakdown.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-xl text-forest">לפי חנות</h2>
            <Link href="/vouchers" className="text-sm font-bold text-forest">
              כל הזיכויים
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {summary.merchantBreakdown.map((m) => (
              <li key={m.merchantName}>
                <Link
                  href={`/vouchers?merchant=${encodeURIComponent(m.merchantName)}`}
                  className="card-surface flex items-center justify-between px-4 py-4"
                >
                  <div>
                    <p className="font-semibold text-night">{m.merchantName}</p>
                    <p className="text-xs text-eggplant">{m.count} מסמכים</p>
                  </div>
                  <p className="font-display text-lg text-forest">
                    {formatIls(m.totalAgorot)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.expiringSoon.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-forest">פגים בקרוב</h2>
          <div className="space-y-3">
            {summary.expiringSoon.map((v) => (
              <VoucherCard key={v.id} voucher={v} />
            ))}
          </div>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-forest">ציר תוקף</h2>
          <ol className="relative space-y-3 border-r-2 border-[rgba(53,94,78,0.28)] pr-4">
            {timeline.map(({ voucher, days }) => (
              <li key={voucher.id}>
                <Link
                  href={`/vouchers/${voucher.id}`}
                  className="card-surface block px-4 py-3"
                >
                  <p className="font-semibold text-night">
                    {voucher.merchantName} · {formatIls(voucher.remainingAmountAgorot)}
                  </p>
                  <p className="text-sm text-eggplant">
                    {voucher.expiryDate}
                    {days < 0
                      ? " · פג תוקף"
                      : days === 0
                        ? " · היום"
                        : ` · בעוד ${days} ימים`}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {summary.recentActivity.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-xl text-forest">פעילות אחרונה</h2>
            <Link href="/activity" className="text-sm font-bold text-forest">
              הכל
            </Link>
          </div>
          <ul className="space-y-2">
            {summary.recentActivity.slice(0, 5).map((a) => (
              <li key={a.id}>
                {a.voucherId ? (
                  <Link
                    href={`/vouchers/${a.voucherId}`}
                    className="card-surface block px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-night">{a.summaryHe}</p>
                    <p className="text-xs text-eggplant">
                      {new Date(a.createdAt).toLocaleString("he-IL")}
                    </p>
                  </Link>
                ) : (
                  <div className="card-surface px-4 py-3 text-sm">
                    <p className="font-medium text-night">{a.summaryHe}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pt-2">
        <Link
          href="/vouchers/new"
          className="btn-primary inline-flex w-full justify-center py-3.5 sm:w-auto sm:px-8"
        >
          הוספת זיכוי
        </Link>
      </div>
    </div>
  );
}
