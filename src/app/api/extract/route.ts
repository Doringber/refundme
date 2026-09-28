import { NextResponse } from "next/server";
import { suggestFieldsFromText, suggestFromFileName } from "@/lib/extract";
import { extractFieldsFromImage } from "@/lib/extract-vision";
import type { ExtractedFields } from "@/lib/types";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";

function mergeFields(
  a: ExtractedFields | null,
  b: ExtractedFields | null,
): ExtractedFields | null {
  if (!a) return b;
  if (!b) return a;
  const merged: ExtractedFields = {
    merchantName: a.merchantName ?? b.merchantName,
    documentType: a.documentType ?? b.documentType,
    amountAgorot: a.amountAgorot ?? b.amountAgorot,
    issueDate: a.issueDate ?? b.issueDate,
    expiryDate: a.expiryDate ?? b.expiryDate,
    voucherCode: a.voucherCode ?? b.voucherCode,
    barcodeValue: a.barcodeValue ?? b.barcodeValue,
    usageTerms: a.usageTerms ?? b.usageTerms,
    confidence:
      a.confidence === "high" || b.confidence === "high"
        ? "high"
        : a.confidence === "low" || b.confidence === "low"
          ? "low"
          : "none",
    notes: a.notes ?? b.notes,
  };
  return merged;
}

/**
 * Extraction endpoint for uploaded voucher photos.
 * Accepts optional `ocrText` from browser OCR + the image file.
 * Prefers Gemini vision when Netlify AI Gateway is available, then OCR text heuristics.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const pastedText = form.get("text");
    const ocrText = form.get("ocrText");

    if (typeof pastedText === "string" && pastedText.trim()) {
      return NextResponse.json({
        fields: suggestFieldsFromText(pastedText),
        source: "text",
      });
    }

    const fromOcr =
      typeof ocrText === "string" && ocrText.trim()
        ? suggestFieldsFromText(ocrText)
        : null;

    if (!(file instanceof File)) {
      if (fromOcr) {
        return NextResponse.json({
          fields: fromOcr,
          source: "ocr",
          message:
            fromOcr.confidence === "none"
              ? "קראנו את התמונה אך לא זוהו שדות ברורים. מלאו ידנית."
              : "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.",
        });
      }
      return NextResponse.json(
        { error: "לא התקבל קובץ", fields: suggestFromFileName("") },
        { status: 400 },
      );
    }

    if (
      !ALLOWED_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return NextResponse.json(
        { error: "סוג קובץ לא נתמך" },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "הקובץ גדול מדי" }, { status: 400 });
    }

    let fromVision: ExtractedFields | null = null;
    if (file.type.startsWith("image/")) {
      fromVision = await extractFieldsFromImage(file);
    }

    const merged = mergeFields(fromVision, fromOcr);
    if (merged && merged.confidence !== "none") {
      const source =
        fromVision && fromVision.confidence !== "none"
          ? fromOcr
            ? "vision+ocr"
            : "vision"
          : "ocr";
      return NextResponse.json({
        fields: {
          ...merged,
          notes: "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.",
        },
        source,
        message: "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.",
      });
    }

    const fields = fromOcr ?? suggestFromFileName(file.name);
    return NextResponse.json({
      fields,
      source: fromOcr ? "ocr" : "heuristic",
      message:
        fields.confidence === "none"
          ? "לא הצלחנו לקרוא את כל השדות מהתמונה. מלאו ידנית לפי המסמך — התמונה תישמר."
          : "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.",
    });
  } catch {
    return NextResponse.json(
      { error: "שגיאה בחילוץ", fields: suggestFromFileName("") },
      { status: 500 },
    );
  }
}
