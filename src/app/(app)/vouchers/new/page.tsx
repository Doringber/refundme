"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BuyMeGiftImportPanel } from "@/components/vouchers/buyme-gift-import";
import {
  valuesFromExtraction,
  VoucherReviewForm,
} from "@/components/vouchers/voucher-form";
import { BagMascot } from "@/components/illustrations/bag-mascot";
import { useAppData } from "@/lib/app-data/context";
import { buyMeVoucherKey, vouchersFromBuyMeGifts } from "@/lib/buyme-import";
import {
  extractBuyMeGifts,
  looksLikeBuyMe,
  suggestFieldsFromText,
  type BuyMeGiftCandidate,
} from "@/lib/extract";
import { clientOcrImage } from "@/lib/images/client-ocr";
import { prepareUploadFile } from "@/lib/images/prepare-upload";
import type { ExtractedFields, Voucher } from "@/lib/types";
import { validateUpload } from "@/lib/validation";

type Step = "upload" | "pick-buyme" | "review" | "success";

export default function NewVoucherPage() {
  const app = useAppData();
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [buyMeGifts, setBuyMeGifts] = useState<BuyMeGiftCandidate[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [documentMeta, setDocumentMeta] = useState<{
    fileName: string | null;
    mimeType: string | null;
    dataUrl: string | null;
  }>({ fileName: null, mimeType: null, dataUrl: null });

  function goReview(next: ExtractedFields, note: string | null) {
    setFields(next);
    setExtractionNote(note);
    setStep("review");
  }

  async function processPrepared(
    prepared: {
      file: File;
      dataUrl: string;
      mimeType: string;
      fileName: string;
      convertedFromHeic: boolean;
    },
    opts: { buyMeMode?: boolean } = {},
  ) {
    setDocumentMeta({
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      dataUrl: prepared.dataUrl,
    });

    setStatus("קורא את הטקסט מהתמונה…");
    let ocrText: string | null = null;
    if (prepared.mimeType.startsWith("image/")) {
      ocrText = await clientOcrImage(prepared.file);
    }

    setStatus("מחלץ שדות מהמסמך…");
    const form = new FormData();
    form.append("file", prepared.file);
    if (ocrText) form.append("ocrText", ocrText);

    const res = await fetch("/api/extract", { method: "POST", body: form });
    const json = (await res.json()) as {
      fields?: ExtractedFields;
      message?: string;
      error?: string;
      source?: string;
    };

    const textForBuyMe = ocrText ?? "";
    if (opts.buyMeMode || looksLikeBuyMe(textForBuyMe)) {
      const gifts = extractBuyMeGifts(textForBuyMe).filter(
        (g) => g.title !== "BuyMe" || g.amountAgorot != null,
      );
      if (gifts.length >= 1) {
        setBuyMeGifts(gifts);
        setExtractionNote(
          gifts.length > 1
            ? "צילום אחד של הרשימה — אפשר לייבא את כל המתנות עם יתרה בלחיצה. הקוד נשאר ב־BuyMe למימוש."
            : "ייבוא מ־BuyMe — אשרו או שמרו.",
        );
        setStep("pick-buyme");
        return;
      }
      if (opts.buyMeMode) {
        const fallback = suggestFieldsFromText(textForBuyMe || "BuyMe");
        goReview(
          {
            ...fallback,
            merchantName: fallback.merchantName ?? "BuyMe",
            documentType: "shopping_voucher",
          },
          "לא זיהינו כרטיסי מתנה ברורים בתמונה. זיכויי BuyMe מסתנכרנים מההגדרות.",
        );
        return;
      }
    }

    let nextFields = json.fields ?? null;
    if ((!nextFields || nextFields.confidence === "none") && ocrText) {
      nextFields = suggestFieldsFromText(ocrText);
    }

    goReview(
      nextFields ?? {
        merchantName: null,
        documentType: null,
        amountAgorot: null,
        issueDate: null,
        expiryDate: null,
        voucherCode: null,
        barcodeValue: null,
        usageTerms: null,
        confidence: "none",
        notes: "מלאו ידנית לפי המסמך",
      },
      [
        json.message ?? nextFields?.notes,
        prepared.convertedFromHeic ? "הקובץ הומר מ־HEIC ל־JPEG לתצוגה." : null,
        json.source ? `מקור חילוץ: ${json.source}` : null,
      ]
        .filter(Boolean)
        .join(" ") || null,
    );
  }

  async function handleFile(
    file: File | null,
    opts: { buyMeMode?: boolean } = {},
  ) {
    if (!file) return;
    setError(null);
    setStatus(null);
    const validation = validateUpload(file);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      setStatus("מכין את התמונה…");
      const prepared = await prepareUploadFile(file);
      await processPrepared(prepared, opts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "העלאת הקובץ נכשלה. אפשר להמשיך למילוי ידני.",
      );
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function continueManual() {
    goReview(
      {
        merchantName: null,
        documentType: null,
        amountAgorot: null,
        issueDate: null,
        expiryDate: null,
        voucherCode: null,
        barcodeValue: null,
        usageTerms: null,
        confidence: "none",
        notes: "מילוי ידני ללא חילוץ",
      },
      "ממשיכים למילוי ידני מלא.",
    );
  }

  async function importAllBuyMe() {
    setBusy(true);
    setError(null);
    try {
      if (app.mode === "supabase" && !app.user) {
        throw new Error("יש להתחבר כדי לשמור זיכויים בענן");
      }
      const { saved } = vouchersFromBuyMeGifts(buyMeGifts, {
        userId: app.user?.id,
        documentMeta,
      });
      const existingKeys = new Set(app.vouchers.map((v) => buyMeVoucherKey(v)).filter(Boolean));
      const newSaved = saved.filter((v) => {
        const key = buyMeVoucherKey(v);
        return key ? !existingKeys.has(key) : true;
      });
      if (!newSaved.length) throw new Error("המתנות האלה כבר נשמרו — לא נוצרו כפילויות");
      for (const v of newSaved) {
        await app.saveVoucher(v);
      }
      setImportedCount(newSaved.length);
      setStep("success");
      window.setTimeout(() => router.push("/dashboard"), 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "הייבוא נכשל");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(voucher: Voucher) {
    setError(null);
    setBusy(true);
    try {
      if (app.mode === "supabase" && !app.user) {
        throw new Error("יש להתחבר כדי לשמור זיכויים בענן");
      }
      const key = buyMeVoucherKey(voucher);
      if (key && app.vouchers.some((item) => buyMeVoucherKey(item) === key)) {
        throw new Error("המתנה הזו כבר נשמרה — לא נוצרה כפילות");
      }
      await app.saveVoucher(voucher);
      setImportedCount(1);
      setStep("success");
      window.setTimeout(() => {
        router.push("/dashboard");
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-forest">צילום חדש</h1>
          <p className="mt-2 text-sm font-semibold text-eggplant">
            תעודה אחת נכנסת לשקית.{" "}
            <Link href="/settings#buyme" className="font-extrabold text-forest underline">
              BuyMe מתחבר בהגדרות
            </Link>
            .
          </p>
        </div>
        <BagMascot className="h-24 w-24 shrink-0" />
      </div>

      {app.mode === "supabase" && !app.user && (
        <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="status">
          יש להתחבר כדי לשמור זיכויים בענן.{" "}
          <a href="/login" className="font-bold text-forest">
            התחברות
          </a>
        </p>
      )}

      {step === "upload" && (
        <div className="card-surface space-y-4 p-5">
          <label className="btn-primary flex cursor-pointer flex-col items-center gap-2 px-4 py-8 text-center">
            <span className="font-display text-2xl">
              צלמו את השובר
            </span>
            <span className="text-sm font-bold opacity-90">
              JPEG, PNG, WebP או PDF · עד 10MB
            </span>
            <input
              type="file"
              accept="image/*,application/pdf,image/heic,image/heif"
              capture="environment"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </label>

          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer font-extrabold text-eggplant">עוד</summary>
            <button
              type="button"
              className="btn-secondary mt-3 min-h-11 w-full"
              onClick={continueManual}
              disabled={busy}
            >
              מילוי ידני בלי צילום
            </button>
          </details>

          {(busy || status) && (
            <p className="text-center text-sm text-eggplant" role="status">
              {status ?? "מעבד…"}
            </p>
          )}
          {error && (
            <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {step === "pick-buyme" && (
        <>
          <BuyMeGiftImportPanel
            gifts={buyMeGifts}
            note={extractionNote}
            busy={busy}
            onImportAll={() => void importAllBuyMe()}
            onPickOne={(gift) =>
              goReview(
                gift.fields,
                "ייבוא מ־BuyMe — אשרו את היתרה לפני השמירה.",
              )
            }
            onBack={() => {
              setBuyMeGifts([]);
              setStep("upload");
            }}
          />
          {error && (
            <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="alert">
              {error}
            </p>
          )}
        </>
      )}

      {step === "review" && fields && (
        <div className="card-surface space-y-4 p-5">
          {extractionNote && (
            <p className="rounded-2xl bg-[rgba(247,226,137,0.45)] px-4 py-3 text-sm">
              {extractionNote}
            </p>
          )}
          {error && (
            <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm" role="alert">
              {error}
            </p>
          )}
          <VoucherReviewForm
            initial={valuesFromExtraction(fields)}
            documentMeta={documentMeta}
            onSubmit={handleSave}
            busy={busy}
          />
        </div>
      )}

      {step === "success" && (
        <div className="card-surface px-6 py-12 text-center" role="status">
          <p className="font-display text-2xl text-forest">
            {importedCount > 1 ? `יובאו ${importedCount} מתנות` : "נשמר בהצלחה"}
          </p>
          <p className="mt-2 text-sm text-eggplant">
            חוזרים ללוח הבקרה עם אנימציית הכדור…
          </p>
        </div>
      )}
    </div>
  );
}
