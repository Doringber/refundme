import { NextResponse } from "next/server";
import { suggestFieldsFromText, suggestFromFileName } from "@/lib/extract";
import { extractFieldsForUpload } from "@/lib/extract-vision";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Server-side extraction endpoint.
 * On Netlify with AI Gateway enabled, voucher photos are read with Gemini vision.
 * Without vision credentials, falls back to filename/text heuristics.
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

    const result = await extractFieldsForUpload(file);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "שגיאה בחילוץ", fields: suggestFromFileName("") },
      { status: 500 },
    );
  }
}
