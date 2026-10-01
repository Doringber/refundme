"use client";

import { useMemo, useState } from "react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { parseShekelInput, agorotToShekels } from "@/lib/calculations";
import type {
  DocumentType,
  ExpiryConfidence,
  ExtractedFields,
  Voucher,
} from "@/lib/types";
import { DEMO_USER_ID } from "@/lib/demo/data";

export interface VoucherFormValues {
  merchantName: string;
  documentType: DocumentType;
  amountShekels: string;
  issueDate: string;
  expiryDate: string;
  expiryConfidence: ExpiryConfidence;
  voucherCode: string;
  barcodeValue: string;
  usageTerms: string;
  notes: string;
}

const emptyValues: VoucherFormValues = {
  merchantName: "",
  documentType: "store_credit",
  amountShekels: "",
  issueDate: "",
  expiryDate: "",
  expiryConfidence: "missing",
  voucherCode: "",
  barcodeValue: "",
  usageTerms: "",
  notes: "",
};

export function valuesFromExtraction(fields: ExtractedFields): VoucherFormValues {
  return {
    merchantName: fields.merchantName ?? "",
    documentType: fields.documentType ?? "store_credit",
    amountShekels:
      fields.amountAgorot != null
        ? String(agorotToShekels(fields.amountAgorot))
        : "",
    issueDate: fields.issueDate ?? "",
    expiryDate: fields.expiryDate ?? "",
    expiryConfidence: fields.expiryDate ? "uncertain" : "missing",
    voucherCode: fields.voucherCode ?? "",
    barcodeValue: fields.barcodeValue ?? "",
    usageTerms: fields.usageTerms ?? "",
    notes: fields.notes ?? "",
  };
}

export function VoucherReviewForm({
  initial,
  documentMeta,
  onSubmit,
  submitLabel = "שמירת זיכוי",
  busy = false,
}: {
  initial?: Partial<VoucherFormValues>;
  documentMeta: {
    fileName: string | null;
    mimeType: string | null;
    dataUrl: string | null;
  };
  onSubmit: (voucher: Voucher) => void | Promise<void>;
  submitLabel?: string;
  busy?: boolean;
}) {
  const [values, setValues] = useState<VoucherFormValues>({
    ...emptyValues,
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof VoucherFormValues) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  const preview = useMemo(() => documentMeta.dataUrl, [documentMeta.dataUrl]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.merchantName.trim()) {
      setError("נא למלא שם חנות");
      return;
    }
    const amount = parseShekelInput(values.amountShekels);
    if (amount === null || amount <= 0) {
      setError("נא למלא סכום תקין");
      return;
    }
    // "missing" means unverified — drop any leftover OCR date so save can proceed
    const expiryConfidence = values.expiryConfidence;
    const expiryDate =
      expiryConfidence === "missing" ? "" : values.expiryDate;

    if (!expiryDate && expiryConfidence === "confirmed") {
      setError("לא ניתן לאשר תוקף בלי תאריך");
      return;
    }

    const now = new Date().toISOString();
    const voucher: Voucher = {
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      merchantId: null,
      merchantName: values.merchantName.trim(),
      documentType: values.documentType,
      status: values.documentType === "receipt" ? "archived" : "active",
      originalAmountAgorot: amount,
      remainingAmountAgorot: amount,
      currency: "ILS",
      issueDate: values.issueDate || null,
      expiryDate: expiryDate || null,
      expiryConfidence: expiryDate ? expiryConfidence : "missing",
      voucherCode: values.voucherCode.trim() || null,
      barcodeValue: values.barcodeValue.trim() || null,
      usageTerms: values.usageTerms.trim() || null,
      notes: values.notes.trim() || null,
      documentPath: null,
      documentMimeType: documentMeta.mimeType,
      documentFileName: documentMeta.fileName,
      documentDataUrl: documentMeta.dataUrl,
      extractionRaw: null,
      fieldsConfirmed: true,
      createdAt: now,
      updatedAt: now,
    };
    void Promise.resolve(onSubmit(voucher)).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {preview && documentMeta.mimeType?.startsWith("image/") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="תצוגה מקדימה של המסמך שהועלה"
          className="max-h-64 w-full rounded-2xl object-contain bg-white"
        />
      )}
      {documentMeta.fileName && (
        <p className="text-xs text-eggplant">
          מסמך מקורי נשמר: {documentMeta.fileName}
        </p>
      )}

      <p className="rounded-2xl bg-[rgba(163,193,226,0.25)] px-4 py-3 text-sm text-night">
        אשרו ותקנו את כל השדות לפני השמירה. לא ממציאים קודים, תאריכים או יתרות.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">חנות / רשת</span>
        <input
          className="input-field"
          value={values.merchantName}
          onChange={set("merchantName")}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">סוג מסמך</span>
        <select
          className="input-field"
          value={values.documentType}
          onChange={set("documentType")}
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      {values.documentType === "receipt" && (
        <p className="rounded-2xl bg-[rgba(247,111,84,0.12)] px-4 py-3 text-sm">
          קבלה או חשבונית נשמרת לתיעוד בלבד ואינה נספרת כזיכוי זמין.
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">סכום מקורי (₪)</span>
        <input
          className="input-field"
          inputMode="decimal"
          value={values.amountShekels}
          onChange={set("amountShekels")}
          placeholder="120"
          required
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">תאריך הנפקה</span>
          <input
            type="date"
            className="input-field"
            value={values.issueDate}
            onChange={set("issueDate")}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">תוקף מודפס</span>
          <input
            type="date"
            className="input-field"
            value={values.expiryDate}
            onChange={set("expiryDate")}
          />
        </label>
      </div>

      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium">ודאות התוקף</legend>
        {(
          [
            ["confirmed", "מאומת — מופיע על המסמך / אושר על ידי"],
            ["uncertain", "לא בטוח — צריך לבדוק"],
            ["missing", "חסר — תוקף לא אומת"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="expiryConfidence"
              checked={values.expiryConfidence === value}
              onChange={() =>
                setValues((v) => ({
                  ...v,
                  expiryConfidence: value,
                  // Unverified expiry must not keep a leftover OCR date
                  expiryDate: value === "missing" ? "" : v.expiryDate,
                }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">קוד שובר</span>
        <input
          className="input-field"
          value={values.voucherCode}
          onChange={set("voucherCode")}
          placeholder="רק אם מופיע על המסמך"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">ברקוד</span>
        <input
          className="input-field"
          value={values.barcodeValue}
          onChange={set("barcodeValue")}
          placeholder="רק אם קריא — לא להמציא"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">תנאי מימוש</span>
        <textarea
          className="input-field min-h-24"
          value={values.usageTerms}
          onChange={set("usageTerms")}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">הערות</span>
        <textarea
          className="input-field min-h-20"
          value={values.notes}
          onChange={set("notes")}
        />
      </label>

      {error && (
        <p className="rounded-2xl bg-[rgba(247,111,84,0.14)] px-4 py-3 text-sm text-[#a33a28]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary w-full py-3.5 text-base"
        disabled={busy}
      >
        {busy ? "שומרים…" : submitLabel}
      </button>
      <p className="text-center text-xs text-eggplant">
        תמונה של שובר אינה מבטיחה שכל חנות תקבל אותה בקופה. שמרו גם את המקור כשאפשר.
      </p>
    </form>
  );
}
