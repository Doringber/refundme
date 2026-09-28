"use client";

import Link from "next/link";
import { CreditOrb } from "@/components/orb/credit-orb";
import { LoadingBlock } from "@/components/ui/loading";
import { VoucherCard } from "@/components/vouchers/voucher-card";
import { daysUntil, formatIls, isSpendable } from "@/lib/calculations";
import { useDemo } from "@/lib/demo/context";

export default function DashboardPage() {
  const demo = useDemo();

  if (!demo.ready) return <LoadingBlock label="טוען את הזיכויים…" />;

  const { summary, profile } = demo;
  const timeline = summary.vouchers
    .filter(isSpendable)
    .filter((v) => v.expiryConfidence === "confirmed" && v.expiryDate)
    .map((v) => ({ voucher: v, days: daysUntil(v.expiryDate)! }))
    .sort((a, b) => a.days - b.days);

  return (
    <div className="space-y-8">
      <CreditOrb
        totalAgorot={summary.totalActiveCreditAgorot}
        nearestExpiring={summary.nearestExpiring}
        daysUntilNearestExpiry={summary.daysUntilNearestExpiry}
        orbScaleAgorot={profile.orbScaleAgorot}
        gainAgorot={demo.lastGainAgorot}
        onGainShown={() => demo.clearGain()}
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl text-night">לפי חנות</h2>
          <Link href="/vouchers" className="text-sm font-semibold text-pool">
            כל הזיכויים
          </Link>
        </div>
        {summary.merchantBreakdown.length === 0 ? (
          <p className="text-sm text-eggplant">עדיין אין זיכויים פעילים.</p>
        ) : (
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
                  <p className="font-display text-lg text-night">
                    {formatIls(m.totalAgorot)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-night">פגים בקרוב</h2>
        {summary.expiringSoon.length === 0 ? (
          <p className="text-sm text-eggplant">
            אין זיכויים עם תוקף מאומת ב־30 הימים הקרובים.
          </p>
        ) : (
          <div className="space-y-3">
            {summary.expiringSoon.map((v) => (
              <VoucherCard key={v.id} voucher={v} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-night">ציר תוקף</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-eggplant">
            אין תאריכי תוקף מאומתים להצגה. מסמכים ללא תאריך לא מקבלים ספירה לאחור.
          </p>
        ) : (
          <ol className="relative space-y-3 border-r-2 border-[rgba(71,181,168,0.35)] pr-4">
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
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl text-night">פעילות אחרונה</h2>
          <Link href="/activity" className="text-sm font-semibold text-pool">
            הכל
          </Link>
        </div>
        <ul className="space-y-2">
          {summary.recentActivity.map((a) => (
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
    </div>
  );
}
