"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingBlock } from "@/components/ui/loading";
import {
  ExpiryBadge,
  StatusBadge,
  TypeBadge,
} from "@/components/ui/status-badge";
import { formatIls, parseShekelInput } from "@/lib/calculations";
import { useDemo } from "@/lib/demo/context";

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const demo = useDemo();
  const router = useRouter();
  const voucher = demo.getVoucher(id);
  const redemptions = demo.getRedemptions(id);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!demo.ready) return <LoadingBlock />;
  if (!voucher) {
    return (
      <div className="card-surface px-6 py-12 text-center">
        <p className="font-display text-xl">המסמך לא נמצא</p>
        <Link href="/vouchers" className="btn-primary mt-4 inline-flex px-5 py-2.5">
          חזרה לרשימה
        </Link>
      </div>
    );
  }

  const isReceipt = voucher.documentType === "receipt";
  const canRedeem =
    !isReceipt &&
    (voucher.status === "active" || voucher.status === "partially_redeemed") &&
    voucher.remainingAmountAgorot > 0;

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const agorot = parseShekelInput(amount);
    if (agorot === null || agorot <= 0) {
      setError("הזינו סכום מימוש תקין");
      return;
    }
    try {
      demo.redeem(voucher!.id, agorot, note.trim() || null);
      setAmount("");
      setNote("");
      setOk("המימוש נרשם. היתרה עודכנה לפי הדיווח שלך.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "המימוש נכשל");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/vouchers" className="text-sm font-semibold text-pool">
        ← חזרה
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl text-night">{voucher.merchantName}</h1>
        <div className="flex flex-wrap gap-2">
          <TypeBadge type={voucher.documentType} />
          <StatusBadge status={voucher.status} />
          <ExpiryBadge
            expiryDate={voucher.expiryDate}
            confidence={voucher.expiryConfidence}
          />
        </div>
      </header>

      <section className="card-surface grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-eggplant">סכום מקורי</p>
          <p className="font-display text-2xl">
            {formatIls(voucher.originalAmountAgorot)}
          </p>
        </div>
        <div>
          <p className="text-xs text-eggplant">
            {isReceipt ? "סכום קבלה" : "יתרה לפי הדיווח שלך"}
          </p>
          <p className="font-display text-2xl">
            {formatIls(
              isReceipt
                ? voucher.originalAmountAgorot
                : voucher.remainingAmountAgorot,
            )}
          </p>
        </div>
      </section>

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">מסמך מקורי</h2>
        {voucher.documentDataUrl && voucher.documentMimeType?.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={voucher.documentDataUrl}
            alt={`מסמך מקורי — ${voucher.merchantName}`}
            className="max-h-96 w-full rounded-2xl object-contain bg-white"
          />
        ) : (
          <div className="rounded-2xl bg-[rgba(163,193,226,0.2)] px-4 py-8 text-center text-sm text-eggplant">
            {voucher.documentFileName
              ? `הקובץ ${voucher.documentFileName} שמור${voucher.documentMimeType === "application/pdf" ? " (PDF)" : ""}.`
              : "אין תצוגה מקדימה — בדמו ללא העלאה."}
            <p className="mt-2 text-xs">
              תמונה אינה מבטיחה שכל קופה תקבל את הצילום במקום המקור.
            </p>
          </div>
        )}
      </section>

      <section className="card-surface space-y-2 p-5 text-sm">
        <h2 className="font-display text-lg">פרטים מאושרים</h2>
        <Row label="תאריך הנפקה" value={voucher.issueDate ?? "—"} />
        <Row
          label="תוקף"
          value={
            voucher.expiryConfidence === "confirmed" && voucher.expiryDate
              ? voucher.expiryDate
              : "תוקף לא אומת"
          }
        />
        <Row label="קוד" value={voucher.voucherCode ?? "—"} />
        <Row label="ברקוד" value={voucher.barcodeValue ?? "—"} />
        <Row label="תנאים" value={voucher.usageTerms ?? "—"} />
        <Row label="הערות" value={voucher.notes ?? "—"} />
      </section>

      {voucher.barcodeValue && (
        <section className="card-surface p-5 text-center">
          <p className="text-xs text-eggplant">ברקוד כפי שנרשם</p>
          <p
            className="mt-2 font-mono text-2xl tracking-[0.3em] text-night"
            aria-label={`ברקוד ${voucher.barcodeValue}`}
          >
            {voucher.barcodeValue}
          </p>
        </section>
      )}

      {canRedeem && (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg">רישום מימוש</h2>
          <p className="text-xs text-eggplant">
            מימוש מלא או חלקי. היתרה מחושבת מהסכום המקורי ומהמימושים שדיווחתם.
          </p>
          <form onSubmit={handleRedeem} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">סכום שמומש (₪)</span>
              <input
                className="input-field"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="לדוגמה 40"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">הערה</span>
              <input
                className="input-field"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && (
              <p className="text-sm text-[#a33a28]" role="alert">
                {error}
              </p>
            )}
            {ok && (
              <p className="text-sm text-[#1f6f67]" role="status">
                {ok}
              </p>
            )}
            <button type="submit" className="btn-primary w-full py-3">
              שמירת מימוש
            </button>
          </form>
        </section>
      )}

      <section className="card-surface space-y-3 p-5">
        <h2 className="font-display text-lg">היסטוריית מימושים</h2>
        {redemptions.length === 0 ? (
          <p className="text-sm text-eggplant">עדיין אין מימושים רשומים.</p>
        ) : (
          <ul className="space-y-2">
            {redemptions.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{formatIls(r.amountAgorot)}</p>
                  <p className="text-xs text-eggplant">
                    {r.redeemedAt}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="btn-danger w-full py-3"
        onClick={() => {
          if (confirm("למחוק את המסמך ואת היסטוריית המימושים שלו?")) {
            demo.removeVoucher(voucher.id);
            router.push("/vouchers");
          }
        }}
      >
        מחיקת מסמך
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[rgba(37,45,69,0.06)] py-2 last:border-0 sm:flex-row sm:justify-between">
      <span className="text-eggplant">{label}</span>
      <span className="font-medium text-night">{value}</span>
    </div>
  );
}
