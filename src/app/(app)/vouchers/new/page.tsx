"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  valuesFromExtraction,
  VoucherReviewForm,
} from "@/components/vouchers/voucher-form";
import { useAppData } from "@/lib/app-data/context";
import { prepareUploadFile } from "@/lib/images/prepare-upload";
import type { ExtractedFields, Voucher } from "@/lib/types";
import { validateUpload } from "@/lib/validation";

type Step = "upload" | "review" | "success";

export default function NewVoucherPage() {
  const app = useAppData();
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [documentMeta, setDocumentMeta] = useState<{
    fileName: string | null;
    mimeType: string | null;
    dataUrl: string | null;
  }>({ fileName: null, mimeType: null, dataUrl: null });

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    const validation = validateUpload(file);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareUploadFile(file);
      setDocumentMeta({
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        dataUrl: prepared.dataUrl,
      });

      const form = new FormData();
      form.append("file", prepared.file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const json = (await res.json()) as {
        fields?: ExtractedFields;
        message?: string;
        error?: string;
      };
      setFields(json.fields ?? null);
      setExtractionNote(
        json.message ??
          json.fields?.notes ??
          (prepared.convertedFromHeic
            ? "הקובץ הומר מ־HEIC ל־JPEG לתצוגה."
            : null),
      );
      if (prepared.convertedFromHeic && json.message) {
        setExtractionNote(
          `${json.message} הקובץ הומר מ־HEIC ל־JPEG לתצוגה.`,
        );
      }
      setStep("review");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "העלאת הקובץ נכשלה. אפשר להמשיך למילוי ידני.",
      );
    } finally {
      setBusy(false);
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
          צילום, העלאת תמונה או PDF — ואז אישור הפרטים לפני שמירה
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

          <button
            type="button"
            className="btn-secondary w-full py-3"
            onClick={continueManual}
            disabled={busy}
          >
            המשך למילוי ידני בלי קובץ
          </button>

          {busy && (
            <p className="text-center text-sm text-eggplant" role="status">
              מעבד את המסמך וקורא מהתמונה…
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
