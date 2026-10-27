"use client";

import { formatIls } from "@/lib/calculations";
import type { BuyMeGiftCandidate } from "@/lib/extract";

export function BuyMeGiftImportPanel({
  gifts,
  note,
  busy,
  onImportAll,
  onPickOne,
  onBack,
}: {
  gifts: BuyMeGiftCandidate[];
  note?: string | null;
  busy?: boolean;
  onImportAll: () => void;
  onPickOne: (gift: BuyMeGiftCandidate) => void;
  onBack: () => void;
}) {
  const withBalance = gifts.filter((g) => g.amountAgorot != null);
  const withoutBalance = gifts.length - withBalance.length;

  return (
    <div className="card-surface space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg text-forest">ייבוא מ־BuyMe</h2>
        <p className="mt-1 text-sm text-eggplant">
          {note ??
            `מצאנו ${gifts.length} מתנות. אפשר לייבא הכל בלחיצה אחת (בלי לצלם כל כרטיס).`}
        </p>
        {withoutBalance > 0 && (
          <p className="mt-2 text-xs text-eggplant">
            {withoutBalance} בלי יתרה כספית (למשל כרטיס לסרט) — לא ייכנסו לייבוא
            המהיר; אפשר להוסיף אותם ידנית אחר כך.
          </p>
        )}
      </div>

      <button
        type="button"
        className="btn-primary w-full py-3.5 text-base"
        disabled={busy || withBalance.length === 0}
        onClick={onImportAll}
        data-testid="buyme-import-all"
      >
        {withBalance.length > 1
          ? `ייבוא הכל (${withBalance.length} מתנות עם יתרה)`
          : withBalance.length === 1
            ? "ייבוא המתנה"
            : "אין מתנות עם יתרה לייבוא"}
      </button>

      <details>
        <summary className="min-h-11 cursor-pointer font-extrabold">מתנה אחת, או חזרה</summary>
        <ul className="mt-3 space-y-2">
          {gifts.map((gift) => (
            <li key={`${gift.title}-${gift.amountAgorot ?? "x"}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-start transition hover:bg-white/16 disabled:opacity-50"
                disabled={busy || gift.amountAgorot == null}
                onClick={() => onPickOne(gift)}
              >
                <span>
                  <span className="block font-display text-base">{gift.title}</span>
                  {gift.fromLabel && (
                    <span className="text-xs text-eggplant">מאת {gift.fromLabel}</span>
                  )}
                </span>
                <span className="font-display text-lg">
                  {gift.amountAgorot != null ? formatIls(gift.amountAgorot) : "בלי יתרה"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn-secondary mt-3 w-full py-3"
          onClick={onBack}
          disabled={busy}
        >
          חזרה
        </button>
      </details>
    </div>
  );
}
