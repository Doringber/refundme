"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  valuesFromExtraction,
  VoucherReviewForm,
} from "@/components/vouchers/voucher-form";
import { useAppData } from "@/lib/app-data/context";
import { clientOcrImage } from "@/lib/images/client-ocr";
import { prepareUploadFile } from "@/lib/images/prepare-upload";
import { suggestFieldsFromText } from "@/lib/extract";
import {
  SHUFERSAL_CREDIT_TEXT,
  SUPERPHARM_CREDIT_TEXT,
  YOCHANANOF_RECEIPT_TEXT,
} from "@/lib/extract-fixtures/israeli-vouchers";
import type { ExtractedFields, Voucher } from "@/lib/types";
import { validateUpload } from "@/lib/validation";

type Step = "upload" | "review" | "success";

const LIVE_SAMPLES = [
  {
    id: "shufersal",
    label: "שופרסל — תעודת זיכוי",
    src: "/sample-vouchers/shufersal-credit.png",
    fixtureText: SHUFERSAL_CREDIT_TEXT,
  },
  {
    id: "superpharm",
    label: "סופר-פארם — שובר זיכוי",
    src: "/sample-vouchers/superpharm-credit.png",
    fixtureText: SUPERPHARM_CREDIT_TEXT,
  },
  {
    id: "yochananof",
    label: "יוחננוף — קבלה",
    src: "/sample-vouchers/yochananof-receipt.png",
    fixtureText: YOCHANANOF_RECEIPT_TEXT,
  },
] as const;

export default function NewVoucherPage() {
  const app = useAppData();
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [documentMeta, setDocumentMeta] = useState<{
    fileName: string | null;
    mimeType: string | null;
    dataUrl: string | null;
  }>({ fileName: null, mimeType: null, dataUrl: null });

  async function processPrepared(
    prepared: {
      file: File;
      dataUrl: string;
      mimeType: string;
      fileName: string;
      convertedFromHeic: boolean;
    },
    opts?: { fixtureText?: string },
  ) {
    setDocumentMeta({
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      dataUrl: prepared.dataUrl,
    });

    setStatus("קורא את הטקסט מהתמונה…");
    let ocrText: string | null = opts?.fixtureText ?? null;
    if (!ocrText && prepared.mimeType.startsWith("image/")) {
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

    // Prefer server merge; if empty but we have OCR/fixture text, parse locally
    let nextFields = json.fields ?? null;
    if (
      (!nextFields || nextFields.confidence === "none") &&
      ocrText
    ) {
      nextFields = suggestFieldsFromText(ocrText);
    }

    setFields(
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
    );

    const notes = [
      json.message ?? nextFields?.notes,
      prepared.convertedFromHeic ? "הקובץ הומר מ־HEIC ל־JPEG לתצוגה." : null,
      json.source ? `מקור חילוץ: ${json.source}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    setExtractionNote(notes || null);
    setStep("review");
  }

  async function handleFile(file: File | null) {
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
      await processPrepared(prepared);
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

  async function handleSample(sample: (typeof LIVE_SAMPLES)[number]) {
    setError(null);
    setBusy(true);
    setStatus("טוען דוגמה חיה…");
    try {
      const res = await fetch(sample.src);
      if (!res.ok) throw new Error("טעינת הדוגמה נכשלה");
      const blob = await res.blob();
      const file = new File([blob], `${sample.id}.png`, {
        type: blob.type || "image/png",
      });
      const prepared = await prepareUploadFile(file);
      await processPrepared(prepared, { fixtureText: sample.fixtureText });
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינת הדוגמה נכשלה");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function continueManual() {
    setFields({
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
    });
    setExtractionNote("ממשיכים למילוי ידני מלא.");
    setStep("review");
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
          צלמו תעודת זיכוי / שובר — התמונה נשמרת והשדות מוצעים לאישור
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
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[rgba(71,181,168,0.45)] bg-[rgba(71,181,168,0.06)] px-4 py-10 text-center">
            <span className="font-display text-xl text-forest">צלמו או העלו מסמך</span>
            <span className="text-sm text-eggplant">
              JPEG, PNG, WebP או PDF · עד 10MB
              <br />
              (HEIC מאייפון יומר אוטומטית אם אפשר)
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

          <div className="space-y-2">
            <p className="text-xs font-bold text-eggplant">דוגמאות חיות לבדיקה</p>
            <div className="flex flex-col gap-2">
              {LIVE_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className="btn-secondary w-full py-2.5 text-sm"
                  disabled={busy}
                  onClick={() => void handleSample(sample)}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

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
          <p className="mt-2 text-sm text-eggplant">חוזרים ללוח הבקרה עם אנימציית הכדור…</p>
        </div>
      )}
    </div>
  );
}
