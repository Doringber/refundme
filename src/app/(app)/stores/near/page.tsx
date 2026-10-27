"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { lookupMallCredits, type MallHit, type MallLookup } from "@/components/stores/mall-credits";
import { useAppData } from "@/lib/app-data/context";

/**
 * Opened from the wallet and from a reminder tap. One precise GPS reading,
 * then credits that can be spent inside about 300m. No background tracking.
 */
export default function NearNowPage() {
  const app = useAppData();
  const [lookup, setLookup] = useState<MallLookup | { status: "locating" }>({
    status: "locating",
  });

  useEffect(() => {
    if (!app.ready) return;
    let cancelled = false;
    void lookupMallCredits(app.vouchers, { fresh: true }).then((result) => {
      if (!cancelled) setLookup(result);
    });
    return () => {
      cancelled = true;
    };
  }, [app.ready, app.vouchers]);

  const hits: MallHit[] = lookup.status === "ready" ? lookup.hits : [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-forest">יש לך זיכוי כאן</h1>
          <p className="mt-3 max-w-sm text-sm font-semibold text-eggplant">
            בתי עסק במרחק הליכה, לפי מיקום מדויק חד-פעמי. בלי מעקב ברקע.
          </p>
        </div>
        <div className="mascot-hello shrink-0">
          <BagMascot mood={hits.length ? "celebrate" : "walk"} className="h-24 w-24" />
        </div>
      </div>

      {lookup.status === "locating" && (
        <p className="text-sm font-extrabold text-eggplant" role="status">
          מאתרים את המיקום…
        </p>
      )}

      {lookup.status === "denied" && (
        <div className="ticket-card space-y-3 px-5 py-6 text-center">
          <p className="font-display text-2xl">צריך אישור למיקום</p>
          <p className="text-sm font-semibold text-eggplant">
            אפשרו מיקום מדויק לדפדפן, ואז רעננו. המיקום לא נשמר אצלנו.
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => window.location.reload()}>
            ניסיתי שוב
          </button>
        </div>
      )}

      {lookup.status === "unavailable" && (
        <p className="text-sm font-semibold text-eggplant" role="status">
          לא הצלחנו לקרוא מיקום עכשיו. אפשר לנסות שוב בעוד רגע.
        </p>
      )}

      {lookup.status === "empty" && (
        <div className="ticket-card px-5 py-8 text-center">
          <p className="font-display text-2xl">אין זיכוי במרחק הליכה</p>
          <p className="mt-2 text-sm font-semibold text-eggplant">
            בתי העסק של הזיכויים רחוקים יותר מהקניון או מהרחוב הזה.
          </p>
        </div>
      )}

      {hits.length > 0 && (
        <ul className="stagger-list space-y-3">
          {hits.map((hit) => (
            <li key={`${hit.voucherId}-${hit.place}`}>
              <Link
                href={`/vouchers/${hit.voucherId}`}
                className="ticket-card flex items-center justify-between gap-3 px-4 py-4"
              >
                <span>
                  <span className="block font-display text-xl text-forest">{hit.place}</span>
                  <span className="mt-1 block text-xs font-extrabold text-eggplant">
                    {hit.merchantName}
                  </span>
                </span>
                <span className="rounded-full bg-[var(--butter)] px-3 py-1 text-xs font-extrabold text-[#1c1c1c]">
                  כאן
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
