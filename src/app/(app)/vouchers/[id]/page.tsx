"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingBlock } from "@/components/ui/loading";
import {
  ExpiryBadge,
  StatusBadge,
  TypeBadge,
} from "@/components/ui/status-badge";
import { CalendarReminders } from "@/components/vouchers/calendar-reminders";
import { DocumentPreview } from "@/components/vouchers/document-preview";
import { useAppData } from "@/lib/app-data/context";
import { formatIls, parseShekelInput } from "@/lib/calculations";

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const app = useAppData();
  const router = useRouter();
  const voucher = app.getVoucher(id);
  const redemptions = app.getRedemptions(id);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!voucher) return;
    void app.resolveDocumentUrl(voucher).then((url) => {
      if (!cancelled) setDocUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [app, voucher]);

  if (!app.ready) return <LoadingBlock />;
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
  const buyMeData =
    voucher.extractionRaw?.provider === "buyme"
      ? voucher.extractionRaw
      : null;
  const buyMeUrl = typeof buyMeData?.url === "string" ? buyMeData.url : null;
  const buyMeId =
    typeof buyMeData?.externalId === "string" ? buyMeData.externalId : null;
  const buyMeSupplier =
    typeof buyMeData?.supplierName === "string"
      ? buyMeData.supplierName
      : null;
  const buyMeShortToken =
    typeof buyMeData?.shortToken === "string" ? buyMeData.shortToken : null;
  const buyMeDescription =
    typeof buyMeData?.supplierDescription === "string"
      ? buyMeData.supplierDescription
      : null;
  const buyMeInstructions =
    typeof buyMeData?.redemptionInstructions === "string"
      ? buyMeData.redemptionInstructions
      : null;
  const canRedeem =
    !isReceipt &&
    (voucher.status === "active" || voucher.status === "partially_redeemed") &&
    voucher.remainingAmountAgorot > 0;

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const agorot = parseShekelInput(amount);
    if (agorot === null || agorot <= 0) {
      setError("הזינו סכום מימוש תקין");
      return;
    }
    setBusy(true);
    try {
      await app.redeem(voucher!.id, agorot, note.trim() || null);
      setAmount("");
      setNote("");
      setOk("המימוש נרשם. היתרה עודכנה לפי הדיווח שלך.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "המימוש נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/vouchers" className="text-sm font-semibold text-forest">
          ← חזרה
        </Link>
        <p className="text-xs font-bold text-eggplant">
          {isReceipt ? "קבלה" : "תעודת זיכוי"}
        </p>
      </div>

      <header className="space-y-2">
        <h1 className="font-display text-3xl text-forest">{voucher.merchantName}</h1>
        <p className="font-display text-3xl text-night">
          {formatIls(
            isReceipt
              ? voucher.originalAmountAgorot
              : voucher.remainingAmountAgorot,
          )}
        </p>
        <p className="text-sm text-eggplant">
          {isReceipt ? "סכום קבלה" : "יתרה לפי הדיווח שלך"}
          {!isReceipt && voucher.originalAmountAgorot !== voucher.remainingAmountAgorot
            ? ` · מקורי ${formatIls(voucher.originalAmountAgorot)}`
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <TypeBadge type={voucher.documentType} />
          <StatusBadge status={voucher.status} />
          <ExpiryBadge
            expiryDate={voucher.expiryDate}
            confidence={voucher.expiryConfidence}
          />
        </div>
      </header>

      {/* Invoice first — the main thing users need at the register */}
      <section className="space-y-2">
        <h2 className="font-display text-lg text-forest">תעודת הזיכוי</h2>
        <DocumentPreview
          url={docUrl}
          mimeType={voucher.documentMimeType}
          fileName={voucher.documentFileName}
          merchantName={voucher.merchantName}
          hero
        />
      </section>

      {!isReceipt &&
        (voucher.status === "active" ||
          voucher.status === "partially_redeemed") && (
          <Link
            href={`/vouchers/${voucher.id}/present`}
            className="btn-primary flex w-full items-center justify-center py-3.5 text-base"
            data-testid="open-present"
          >
            הצגה בקופה — קוד וברקוד
          </Link>
        )}

      {buyMeData && (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg text-forest">פרטי BuyMe</h2>
          {buyMeUrl && (
            <a
              href={buyMeUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-[rgba(71,181,168,0.12)] px-3 py-3 text-sm font-bold text-forest underline"
            >
              פתיחת השובר המקורי ב־BuyMe ↗
            </a>
          )}
          <Row label="מזהה שובר ב־BuyMe" value={buyMeId ?? "—"} />
          <Row label="ספק" value={buyMeSupplier ?? voucher.merchantName} />
          <Row
            label="סכום מקורי ב־BuyMe"
            value={formatIls(voucher.originalAmountAgorot)}
          />
          {buyMeShortToken && <Row label="מזהה תעודה" value={buyMeShortToken} />}
          {buyMeDescription && (
            <div className="rounded-xl bg-white/10 px-3 py-3 text-xs leading-relaxed text-eggplant">
              <p className="font-bold text-forest">פרטי הספק</p>
              <p className="mt-1 whitespace-pre-line">{buyMeDescription}</p>
            </div>
          )}
          {buyMeInstructions && (
            <div className="rounded-xl bg-white/10 px-3 py-3 text-xs leading-relaxed text-eggplant">
              <p className="font-bold text-forest">הוראות מימוש</p>
              <p className="mt-1 whitespace-pre-line">{buyMeInstructions}</p>
            </div>
          )}
          {!voucher.voucherCode && !voucher.barcodeValue && (
            <p className="text-xs leading-relaxed text-eggplant">
              BuyMe לא החזיר קוד או מספר ברקוד עבור השובר הזה. RefundMe לא
              ממציא ברקוד — השתמשו בכפתור ״הצגה בקופה״ כדי לראות את הנתונים
              שנשמרו, או פתחו את השובר המקורי אם BuyMe מציג שם QR/ברקוד.
            </p>
          )}
        </section>
      )}

      {(voucher.voucherCode || voucher.barcodeValue) && (
        <section className="card-surface space-y-3 p-5 text-center">
          {voucher.voucherCode && (
            <div>
              <p className="text-xs text-eggplant">קוד שובר</p>
              <p className="mt-1 font-mono text-xl tracking-wide text-night">
                {voucher.voucherCode}
              </p>
            </div>
          )}
          {voucher.barcodeValue && (
            <div>
              <p className="text-xs text-eggplant">ברקוד</p>
              <p
                className="mt-1 font-mono text-2xl tracking-[0.28em] text-night"
                aria-label={`ברקוד ${voucher.barcodeValue}`}
              >
                {voucher.barcodeValue}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="card-surface space-y-2 p-5 text-sm">
        <h2 className="font-display text-lg">פרטים</h2>
        <Row label="תאריך הנפקה" value={voucher.issueDate ?? "—"} />
        <Row
          label="תוקף"
          value={
            voucher.expiryConfidence === "confirmed" && voucher.expiryDate
              ? voucher.expiryDate
              : "תוקף לא אומת"
          }
        />
        <Row label="תנאים" value={voucher.usageTerms ?? "—"} />
        <Row label="הערות" value={voucher.notes ?? "—"} />
      </section>

      <CalendarReminders
        voucher={voucher}
        reminderDays={app.profile.reminderDays}
      />

      {canRedeem && (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg">רישום מימוש</h2>
          <p className="text-xs text-eggplant">
            מימוש מלא או חלקי. היתרה מחושבת מהסכום המקורי ומהמימושים שדיווחתם.
          </p>
          <form onSubmit={(e) => void handleRedeem(e)} className="space-y-3">
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
            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "שומרים…" : "שמירת מימוש"}
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
            void Promise.resolve(app.removeVoucher(voucher.id)).then(() => {
              router.push("/vouchers");
            });
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
