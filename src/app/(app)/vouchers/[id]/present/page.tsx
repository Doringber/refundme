"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingBlock } from "@/components/ui/loading";
import { AddVoucherCodeForm } from "@/components/vouchers/add-voucher-code";
import { Code128Barcode } from "@/components/vouchers/code128-barcode";
import { DocumentPreview } from "@/components/vouchers/document-preview";
import { useAppData } from "@/lib/app-data/context";
import { barcodePayload } from "@/lib/barcode/code128";
import { formatIls } from "@/lib/calculations";
import {
  buyMeOpenUrl,
  checkoutKind,
  type CheckoutKind,
} from "@/lib/vouchers/checkout-display";

export default function VoucherPresentPage() {
  const { id } = useParams<{ id: string }>();
  const app = useAppData();
  const voucher = app.getVoucher(id);
  const [copied, setCopied] = useState(false);
  const [bright, setBright] = useState(true);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  useEffect(() => {
    let wake: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock) {
      void nav.wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) {
            void lock.release();
            return;
          }
          wake = lock;
        })
        .catch(() => {
          /* unsupported / denied */
        });
    }
    return () => {
      cancelled = true;
      void wake?.release();
    };
  }, []);

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
  const kind: CheckoutKind = checkoutKind(voucher);
  const code = voucher.voucherCode?.trim() || null;
  const barcode = voucher.barcodeValue?.trim() || null;
  const payload = barcodePayload({ barcodeValue: barcode, voucherCode: code });
  const displayCode = code ?? barcode;
  const buyMeUrl = buyMeOpenUrl(voucher);
  const fullScreen = kind === "code";

  async function copyCode() {
    if (!displayCode) return;
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  }

  const shell = fullScreen
    ? `fixed inset-0 z-50 flex flex-col overflow-auto transition-colors ${
        bright ? "bg-white text-black" : "bg-[color:var(--bg)] text-[color:var(--foreground)]"
      }`
    : "mx-auto max-w-xl";

  return (
    <div className={shell} data-testid="present-screen" data-present-kind={kind}>
      <div className={`mx-auto flex w-full max-w-xl flex-col px-4 py-4 ${fullScreen ? "flex-1" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/vouchers/${voucher.id}`}
            className={`text-sm font-extrabold ${
              fullScreen && bright ? "text-black/70" : "text-forest"
            }`}
          >
            ← חזרה
          </Link>
          {fullScreen && (
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                bright ? "bg-black/8 text-black" : "bg-white/10 text-[color:var(--foreground)]"
              }`}
              onClick={() => setBright((value) => !value)}
            >
              {bright ? "מצב כהה" : "מסך בהיר לסריקה"}
            </button>
          )}
        </div>

        <header className="mt-6 space-y-1 text-center">
          <p
            className={`text-xs font-bold tracking-wide ${
              fullScreen && bright ? "text-black/50" : "text-eggplant"
            }`}
          >
            הצגה בקופה
          </p>
          <h1 className="font-display text-3xl md:text-4xl">{voucher.merchantName}</h1>
          <p className="font-display text-2xl md:text-3xl">
            {formatIls(
              isReceipt ? voucher.originalAmountAgorot : voucher.remainingAmountAgorot,
            )}
          </p>
          {!isReceipt && (
            <p className={`text-xs ${fullScreen && bright ? "text-black/45" : "text-eggplant"}`}>
              יתרה לפי הדיווח שלך
            </p>
          )}
        </header>

        <section className={`mt-6 space-y-4 ${kind === "code" ? "flex flex-1 flex-col items-center justify-center" : ""}`}>
          {kind === "code" && displayCode && (
            <div className="w-full space-y-3 text-center">
              <p className={`text-xs font-bold ${bright ? "text-black/45" : "text-eggplant"}`}>
                {code ? "קוד שובר" : "ברקוד"}
              </p>
              <p
                className="select-all break-all font-mono text-4xl font-bold tracking-[0.12em] md:text-5xl"
                data-testid="present-code"
              >
                {displayCode}
              </p>
              <button
                type="button"
                onClick={() => void copyCode()}
                className={`rounded-full px-5 py-2.5 text-sm font-extrabold ${
                  bright ? "bg-black text-white" : "btn-primary"
                }`}
              >
                {copied ? "הועתק" : "העתקת קוד"}
              </button>
            </div>
          )}

          {kind === "code" && payload && (
            <div className="w-full max-w-md rounded-2xl bg-white px-3 py-4">
              <div className="flex justify-center overflow-x-auto">
                <Code128Barcode
                  barcodeValue={barcode}
                  voucherCode={code}
                  className="min-w-[240px] [&_svg]:h-24 [&_svg]:w-auto"
                />
              </div>
              {barcode && code && barcode !== code && (
                <p className="mt-2 text-center font-mono text-xs tracking-widest text-black/55">
                  {barcode}
                </p>
              )}
            </div>
          )}

          {kind === "buyme" && buyMeUrl && (
            <div
              className={`space-y-3 rounded-3xl px-4 py-5 text-center ${
                bright ? "bg-black/[0.04]" : "bg-white/10"
              }`}
              data-testid="present-buyme"
            >
              <p className={`text-sm leading-relaxed ${bright ? "text-black/70" : "text-eggplant"}`}>
                BuyMe לא החזיר קוד קופה לרשימת הארנק. אם יש קוד או QR, הם
                מופיעים בשובר המקורי. RefundMe לא ממציא ברקוד.
              </p>
              <a
                href={buyMeUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex w-full items-center justify-center py-3.5 text-base"
              >
                פתיחת השובר ב־BuyMe
              </a>
            </div>
          )}

          {(kind === "document" || (kind === "buyme" && docUrl)) && docUrl && (
            <DocumentPreview
              url={docUrl}
              mimeType={voucher.documentMimeType}
              fileName={voucher.documentFileName}
              merchantName={voucher.merchantName}
              hero
            />
          )}

          {kind === "none" && (
            <div className="card-surface space-y-4 p-5" data-testid="present-empty">
              <p className="text-sm leading-relaxed text-eggplant">
                אין קוד, ברקוד, קישור ל־BuyMe או תמונת מסמך להצגה בקופה. אפשר
                להוסיף את הקוד שמופיע על השובר.
              </p>
              <AddVoucherCodeForm
                onSave={(next) => app.saveVoucherCode(voucher.id, next)}
              />
            </div>
          )}

          {kind !== "code" && kind !== "none" && !code && (
            <AddVoucherCodeForm onSave={(next) => app.saveVoucherCode(voucher.id, next)} />
          )}
        </section>

        <p
          className={`mt-6 pb-4 text-center text-xs leading-relaxed ${
            fullScreen && bright ? "text-black/40" : "text-eggplant"
          }`}
        >
          {kind === "code"
            ? "הציגו את הקוד או את הברקוד לקופאי. אחרי המימוש — רשמו אותו באפליקציה כדי לעדכן את היתרה."
            : kind === "buyme"
              ? "פתחו את השובר ב־BuyMe והציגו לקופאי את מה שמופיע שם. אחרי המימוש — רשמו אותו כאן."
              : kind === "document"
                ? "הציגו את תעודת הזיכוי. אם מודפס עליה קוד, הוסיפו אותו כאן."
                : "בלי קוד שמור אין מה להציג לקופאי מתוך המסך הזה."}
        </p>
      </div>
    </div>
  );
}
