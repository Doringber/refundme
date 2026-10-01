"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  valuesFromExtraction,
  VoucherReviewForm,
} from "@/components/vouchers/voucher-form";
import { useAppData } from "@/lib/app-data/context";
import { formatIls } from "@/lib/calculations";
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
  const buyMeInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [buyMeGifts, setBuyMeGifts] = useState<BuyMeGiftCandidate[]>([]);
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
      if (gifts.length > 1) {
        setBuyMeGifts(gifts);
        setExtractionNote(
          "מצאנו כמה מתנות בצילום — בחרו איזו לייבא. אפשר לחזור ולצלם מתנה בודדת.",
        );
        setStep("pick-buyme");
        return;
      }
      if (gifts.length === 1) {
        goReview(
          gifts[0].fields,
          "ייבוא מ־BuyMe — אשרו את היתרה לפני השמירה. המימוש ב־BuyMe / בבית העסק.",
        );
        return;
      }
      if (opts.buyMeMode) {
        // Forced BuyMe button but OCR didn't parse cards — still try heuristics
        const fallback = suggestFieldsFromText(textForBuyMe || "BuyMe");
        goReview(
          {
            ...fallback,
            merchantName: fallback.merchantName ?? "BuyMe",
            documentType: "shopping_voucher",
          },
          "לא זיהינו כרטיס מתנה ברור — מלאו ידנית לפי הצילום מ־BuyMe.",
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

  async function handleSave(voucher: Voucher) {
    setError(null);
    setBusy(true);
    try {
      if (app.mode === "supabase" && !app.user) {
        throw new Error("יש להתחבר כדי לשמור זיכויים בענן");
      }
      await app.saveVoucher(voucher);
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
      <div>
        <h1 className="font-display text-2xl text-forest">הוספת זיכוי</h1>
        <p className="text-sm text-eggplant">
          צלמו תעודת זיכוי / שובר — או ייבוא בלחיצה מ־BuyMe
        </p>
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
          <button
            type="button"
            className="btn-primary flex w-full flex-col items-center gap-1 py-4 text-base"
            disabled={busy}
            onClick={() => buyMeInputRef.current?.click()}
            data-testid="buyme-import-button"
          >
            <span>ייבוא מ־BuyMe</span>
            <span className="text-xs font-semibold opacity-80">
              צלמו־מסך של המתנה ב־«המתנות שלי»
            </span>
          </button>
          <input
            ref={buyMeInputRef}
            type="file"
            accept="image/*,image/heic,image/heif"
            capture="environment"
            className="sr-only"
            aria-label="צילום מסך מ־BuyMe"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              void handleFile(file, { buyMeMode: true });
            }}
            disabled={busy}
          />

          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[rgba(71,181,168,0.45)] bg-[rgba(71,181,168,0.06)] px-4 py-8 text-center">
            <span className="font-display text-xl text-forest">
              צלמו תעודת זיכוי / שובר
            </span>
            <span className="text-sm text-eggplant">
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

          <button
            type="button"
            className="btn-secondary w-full py-3"
            onClick={continueManual}
            disabled={busy}
          >
            המשך למילוי ידני בלי קובץ
          </button>

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
        <div className="card-surface space-y-4 p-5">
          <div>
            <h2 className="font-display text-lg text-forest">בחירת מתנה מ־BuyMe</h2>
            <p className="mt-1 text-sm text-eggplant">
              {extractionNote ?? "בחרו מתנה אחת לייבוא"}
            </p>
          </div>
          <ul className="space-y-2">
            {buyMeGifts.map((gift) => (
              <li key={`${gift.title}-${gift.amountAgorot ?? "x"}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-start transition hover:bg-white/16"
                  onClick={() =>
                    goReview(
                      gift.fields,
                      "ייבוא מ־BuyMe — אשרו את היתרה לפני השמירה.",
                    )
                  }
                >
                  <span>
                    <span className="block font-display text-base">
                      {gift.title}
                    </span>
                    {gift.fromLabel && (
                      <span className="text-xs text-eggplant">
                        מאת {gift.fromLabel}
                      </span>
                    )}
                  </span>
                  <span className="font-display text-lg">
                    {gift.amountAgorot != null
                      ? formatIls(gift.amountAgorot)
                      : "בלי יתרה"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-secondary w-full py-3"
            onClick={() => {
              setBuyMeGifts([]);
              setStep("upload");
            }}
          >
            חזרה
          </button>
        </div>
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
          <p className="font-display text-2xl text-forest">נשמר בהצלחה</p>
          <p className="mt-2 text-sm text-eggplant">
            חוזרים ללוח הבקרה עם אנימציית הכדור…
          </p>
        </div>
      )}
    </div>
  );
}
