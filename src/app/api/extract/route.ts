import { NextResponse } from "next/server";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { suggestFieldsFromText, suggestFromFileName } from "@/lib/extract";
import {
  canUseVisionExtraction,
  extractFieldsFromImage,
  shouldRunVisionExtraction,
} from "@/lib/extract-vision";
import { logServerError } from "@/lib/log";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ExtractedFields } from "@/lib/types";

export const runtime = "nodejs";

const MAX_EXTRACT_TEXT_CHARS = 100_000;

function boundedText(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_EXTRACT_TEXT_CHARS);
}

async function callerIsAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch (error) {
    logServerError("extract", error);
    return false;
  }
}

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
    const pastedText = boundedText(form.get("text"));
    const ocrText = boundedText(form.get("ocrText"));

    if (pastedText) {
      return NextResponse.json({
        fields: suggestFieldsFromText(pastedText),
        source: "text",
      });
    }

    const fromOcr = ocrText ? suggestFieldsFromText(ocrText) : null;

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

    const visionConfigured = canUseVisionExtraction();
    const supabaseConfigured = isSupabaseConfigured();
    const authenticated =
      visionConfigured && supabaseConfigured
        ? await callerIsAuthenticated()
        : false;
    let fromVision: ExtractedFields | null = null;
    const runVision = shouldRunVisionExtraction({
      visionConfigured,
      supabaseConfigured,
      authenticated,
    });
    if (runVision && file.type.startsWith("image/")) {
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
  } catch (error) {
    logServerError("extract", error);
    return NextResponse.json(
      { error: "שגיאה בחילוץ", fields: suggestFromFileName("") },
      { status: 500 },
    );
  }
}
