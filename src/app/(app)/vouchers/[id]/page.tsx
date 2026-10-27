"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TicketSlip } from "@/components/illustrations/bag-mascot";
import { BackLink } from "@/components/layout/back-link";
import { LoadingBlock } from "@/components/ui/loading";
import {
  ExpiryBadge,
  StatusBadge,
  TypeBadge,
} from "@/components/ui/status-badge";
import { AddVoucherCodeForm } from "@/components/vouchers/add-voucher-code";
import { CalendarReminders } from "@/components/vouchers/calendar-reminders";
import { DocumentPreview } from "@/components/vouchers/document-preview";
import { useAppData } from "@/lib/app-data/context";
import { formatIls, parseShekelInput } from "@/lib/calculations";
import { buyMeOpenUrl, checkoutKind } from "@/lib/vouchers/checkout-display";

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
        <BackLink href="/vouchers" label="חזרה לרשימה" className="mt-4" />
      </div>
    );
  }

  const viewerId = app.user?.id ?? app.profile.id;
  const isOwner = voucher.userId === viewerId;
  const isReceipt = voucher.documentType === "receipt";
  const buyMeData =
    voucher.extractionRaw?.provider === "buyme"
      ? voucher.extractionRaw
      : null;
  const buyMeUrl = buyMeOpenUrl(voucher);
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
      <BackLink href="/vouchers" />

      <header className="space-y-3">
        <h1 className="font-display text-4xl leading-none text-forest">{voucher.merchantName}</h1>
        <TicketSlip
          amount={formatIls(
            isReceipt
              ? voucher.originalAmountAgorot
              : voucher.remainingAmountAgorot,
          )}
          caption={
            isReceipt
              ? "סכום קבלה"
              : voucher.originalAmountAgorot !== voucher.remainingAmountAgorot
                ? `לפי הדיווח שלך · מקורי ${formatIls(voucher.originalAmountAgorot)}`
                : "לפי הדיווח שלך"
          }
          className="inline-block"
        />
        <div className="flex flex-wrap gap-2">
          {voucher.shared ? (
            <span className="rounded-full bg-[var(--butter)] px-3 py-1 text-xs font-extrabold text-[#1c1c1c]">
              {isOwner
                ? "בארנק המשותף"
                : `של ${voucher.ownerName || "בן/בת הזוג"}`}
            </span>
          ) : null}
          <TypeBadge type={voucher.documentType} />
          <StatusBadge status={voucher.status} />
          <ExpiryBadge
            expiryDate={voucher.expiryDate}
            confidence={voucher.expiryConfidence}
          />
        </div>
      </header>

      {docUrl || voucher.documentFileName ? (
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
      ) : (
        <p className="text-sm text-eggplant">אין תמונת מסמך לשובר הזה.</p>
      )}

      {checkoutKind(voucher) === "code" && (
        <Link
          href={`/vouchers/${voucher.id}/present`}
          className="btn-primary flex w-full items-center justify-center text-base"
          data-testid="open-present"
        >
          הצגה בקופה
        </Link>
      )}
      {checkoutKind(voucher) === "buyme" && buyMeUrl && (
        <a
          href={buyMeUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-primary flex w-full items-center justify-center text-base"
          data-testid="open-buyme"
        >
          פתיחה ב־BuyMe
        </a>
      )}
      {checkoutKind(voucher) === "document" && (
        <Link
          href={`/vouchers/${voucher.id}/present`}
          className="btn-primary flex w-full items-center justify-center text-base"
          data-testid="open-present"
        >
          הצגת התעודה
        </Link>
      )}

      {buyMeData && (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg text-forest">פרטי BuyMe</h2>
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
              {buyMeUrl
                ? "BuyMe לא החזיר קוד קופה לרשימה. הקוד או ה־QR, אם BuyMe הנפיק אחד, נמצאים בקישור למעלה. RefundMe לא ממציא ברקוד."
                : "BuyMe לא החזיר קוד, ברקוד או קישור לשובר. RefundMe לא ממציא ברקוד. אפשר להוסיף קוד ידנית אם הוא מודפס על השובר."}
            </p>
          )}
        </section>
      )}

      {isOwner ? (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg">שיתוף עם הבית</h2>
          <p className="text-sm leading-relaxed text-eggplant">
            {voucher.shared
              ? "בני הבית רואים את הזיכוי ויכולים לרשום מימוש. רק אתם עורכים או מוחקים."
              : "כבוי כרגע. אחרי שמצטרפים לארנק, בני הבית יראו את הזיכוי רק אם תדליקו את זה."}
          </p>
          <button
            type="button"
            className="btn-secondary min-h-11 w-full py-3"
            disabled={busy}
            onClick={() => {
              setError(null);
              setBusy(true);
              void Promise.resolve(app.setVoucherShared(voucher.id, !voucher.shared))
                .then(() => {
                  setOk(voucher.shared ? "הזיכוי חזר להיות פרטי." : "הזיכוי בארנק המשותף.");
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "השיתוף נכשל");
                })
                .finally(() => setBusy(false));
            }}
          >
            {voucher.shared ? "הסרה מהארנק המשותף" : "שיתוף עם הבית"}
          </button>
        </section>
      ) : (
        <section className="card-surface space-y-2 p-5">
          <h2 className="font-display text-lg">זיכוי משותף</h2>
          <p className="text-sm leading-relaxed text-eggplant">
            זה זיכוי של {voucher.ownerName || "בן/בת הזוג"}. אפשר לרשום מימוש.
            אי אפשר לערוך או למחוק.
          </p>
        </section>
      )}

      {!voucher.voucherCode && !voucher.barcodeValue && !isReceipt && isOwner && (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-lg">קוד לקופה</h2>
          <p className="text-xs leading-relaxed text-eggplant">
            בלי קוד שמור אין מסך סריקה. הוסיפו את הקוד שמופיע על השובר או
            ב־BuyMe.
          </p>
          <AddVoucherCodeForm
            onSave={(code) => app.saveVoucherCode(voucher.id, code)}
          />
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
            <button type="submit" className="btn-secondary w-full py-3" disabled={busy}>
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
                    {r.userId === viewerId ? " · אתם" : " · בן/בת הזוג"}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
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
      ) : null}
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
