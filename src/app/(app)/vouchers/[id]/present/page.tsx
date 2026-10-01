"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingBlock } from "@/components/ui/loading";
import { Code128Barcode } from "@/components/vouchers/code128-barcode";
import { useAppData } from "@/lib/app-data/context";
import { barcodePayload } from "@/lib/barcode/code128";
import { formatIls } from "@/lib/calculations";

export default function VoucherPresentPage() {
  const { id } = useParams<{ id: string }>();
  const app = useAppData();
  const voucher = app.getVoucher(id);
  const [copied, setCopied] = useState(false);
  const [bright, setBright] = useState(true);

  useEffect(() => {
    // Prefer staying awake at the register when supported
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
  const code = voucher.voucherCode?.trim() || null;
  const barcode = voucher.barcodeValue?.trim() || null;
  const payload = barcodePayload({
    barcodeValue: barcode,
    voucherCode: code,
  });
  const displayCode = code ?? barcode;

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

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col overflow-auto transition-colors ${
        bright
          ? "bg-white text-black"
          : "bg-[color:var(--bg)] text-[color:var(--foreground)]"
      }`}
      data-testid="present-screen"
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/vouchers/${voucher.id}`}
            className={`text-sm font-extrabold ${
              bright ? "text-black/70" : "text-forest"
            }`}
          >
            ← חזרה
          </Link>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              bright
                ? "bg-black/8 text-black"
                : "bg-white/10 text-[color:var(--foreground)]"
            }`}
            onClick={() => setBright((v) => !v)}
          >
            {bright ? "מצב כהה" : "מסך בהיר לסריקה"}
          </button>
        </div>

        <header className="mt-6 space-y-1 text-center">
          <p
            className={`text-xs font-bold tracking-wide ${
              bright ? "text-black/50" : "text-eggplant"
            }`}
          >
            הצגה בקופה
          </p>
          <h1 className="font-display text-3xl md:text-4xl">
            {voucher.merchantName}
          </h1>
          <p className="font-display text-2xl md:text-3xl">
            {formatIls(
              isReceipt
                ? voucher.originalAmountAgorot
                : voucher.remainingAmountAgorot,
            )}
          </p>
          {!isReceipt && (
            <p
              className={`text-xs ${
                bright ? "text-black/45" : "text-eggplant"
              }`}
            >
              יתרה לפי הדיווח שלך
            </p>
          )}
        </header>

        <section className="mt-8 flex flex-1 flex-col items-center justify-center gap-6">
          {displayCode ? (
            <div className="w-full space-y-3 text-center">
              <p
                className={`text-xs font-bold ${
                  bright ? "text-black/45" : "text-eggplant"
                }`}
              >
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
                  bright
                    ? "bg-black text-white"
                    : "btn-primary"
                }`}
              >
                {copied ? "הועתק" : "העתקת קוד"}
              </button>
            </div>
          ) : (
            <p
              className={`text-center text-sm ${
                bright ? "text-black/55" : "text-eggplant"
              }`}
            >
              אין קוד או ברקוד שמורים — הציגו את תעודת הזיכוי מהמסמך.
            </p>
          )}

          {payload && (
            <div
              className={`w-full max-w-md rounded-2xl px-3 py-4 ${
                bright ? "bg-white" : "bg-white"
              }`}
            >
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
        </section>

        <p
          className={`mt-8 pb-4 text-center text-xs leading-relaxed ${
            bright ? "text-black/40" : "text-eggplant"
          }`}
        >
          הציגו את הקוד או את הברקוד לקופאי. אחרי המימוש — רשמו אותו באפליקציה
          כדי לעדכן את היתרה.
        </p>
      </div>
    </div>
  );
}
