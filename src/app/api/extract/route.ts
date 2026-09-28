import { NextResponse } from "next/server";
import { suggestFieldsFromText, suggestFromFileName } from "@/lib/extract";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Server-side extraction endpoint.
 * Privileged OCR keys (if any) stay here — never in the client.
 * Without OCR credentials, returns heuristic suggestions or empty manual flow.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const pastedText = form.get("text");

    if (typeof pastedText === "string" && pastedText.trim()) {
      return NextResponse.json({
        fields: suggestFieldsFromText(pastedText),
        source: "text",
      });
    }

    if (!(file instanceof File)) {
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

    const ocrKey = process.env.DOCUMENT_OCR_API_KEY;
    if (ocrKey) {
      // Placeholder for a real OCR provider — keep the contract stable.
      // Without implementing a paid vendor, fall through to heuristics.
    }

    // PDF text is not extracted without a dedicated parser in v1.
    // Image OCR requires an external key. Offer filename heuristics only.
    const fields = suggestFromFileName(file.name);

    return NextResponse.json({
      fields,
      source: "heuristic",
      message:
        fields.confidence === "none"
          ? "חילוץ אוטומטי אינו זמין. מלאו את השדות ידנית לפי המסמך."
          : "הוצעו שדות ראשוניים — אשרו ותקנו לפני השמירה.",
    });
  } catch {
    return NextResponse.json(
      { error: "שגיאה בחילוץ", fields: suggestFromFileName("") },
      { status: 500 },
    );
  }
}
