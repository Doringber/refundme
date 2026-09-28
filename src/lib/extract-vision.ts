import type { DocumentType, ExtractedFields } from "./types";
import { suggestFieldsFromText, suggestFromFileName } from "./extract";

type VisionJson = {
  merchantName?: string | null;
  documentType?: DocumentType | null;
  amountShekels?: number | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  voucherCode?: string | null;
  barcodeValue?: string | null;
  usageTerms?: string | null;
  rawText?: string | null;
};

const SYSTEM_PROMPT = `You extract fields from Israeli store-credit / gift-voucher / shopping-voucher / receipt photos.
Return ONLY valid JSON with keys:
merchantName, documentType, amountShekels, issueDate, expiryDate, voucherCode, barcodeValue, usageTerms, rawText.
Rules:
- documentType must be one of: store_credit, gift_voucher, shopping_voucher, receipt, or null
- Dates as YYYY-MM-DD only when clearly printed; otherwise null
- Never invent barcode, voucher code, amount, or expiry — use null if unsure
- amountShekels is a number in shekels (e.g. 280), not agorot
- Prefer Hebrew merchant names when printed in Hebrew
- rawText: short transcription of visible key lines`;

function emptyFields(notes: string): ExtractedFields {
  return {
    merchantName: null,
    documentType: null,
    amountAgorot: null,
    issueDate: null,
    expiryDate: null,
    voucherCode: null,
    barcodeValue: null,
    usageTerms: null,
    confidence: "none",
    notes,
  };
}

function normalizeVision(json: VisionJson): ExtractedFields {
  const amountAgorot =
    typeof json.amountShekels === "number" && Number.isFinite(json.amountShekels)
      ? Math.round(json.amountShekels * 100)
      : null;

  const documentType =
    json.documentType &&
    ["store_credit", "gift_voucher", "shopping_voucher", "receipt"].includes(
      json.documentType,
    )
      ? json.documentType
      : null;

  const confidence: ExtractedFields["confidence"] =
    json.merchantName || amountAgorot || documentType ? "low" : "none";

  // Prefer structured JSON; fill gaps from rawText heuristics without inventing.
  const fromText = json.rawText ? suggestFieldsFromText(json.rawText) : null;

  return {
    merchantName: json.merchantName ?? fromText?.merchantName ?? null,
    documentType: documentType ?? fromText?.documentType ?? null,
    amountAgorot: amountAgorot ?? fromText?.amountAgorot ?? null,
    issueDate: json.issueDate ?? fromText?.issueDate ?? null,
    expiryDate: json.expiryDate ?? fromText?.expiryDate ?? null,
    voucherCode: json.voucherCode ?? fromText?.voucherCode ?? null,
    barcodeValue: json.barcodeValue ?? null,
    usageTerms: json.usageTerms ?? null,
    confidence,
    notes: "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.",
  };
}

function parseJsonContent(text: string): VisionJson | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate) as VisionJson;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as VisionJson;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** True when Netlify AI Gateway / Gemini env is available */
export function canUseVisionExtraction(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_BASE_URL,
  );
}

/**
 * Read printed fields from an uploaded voucher photo via Gemini
 * (works on Netlify AI Gateway without managing a provider key).
 */
export async function extractFieldsFromImage(
  file: File,
): Promise<ExtractedFields | null> {
  if (!canUseVisionExtraction()) return null;
  if (!file.type.startsWith("image/")) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({});
    const bytes = Buffer.from(await file.arrayBuffer());
    const b64 = bytes.toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inlineData: {
                mimeType: file.type || "image/jpeg",
                data: b64,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return null;
    const parsed = parseJsonContent(text);
    if (!parsed) {
      return emptyFields("החילוץ מהתמונה לא הצליח — מלאו ידנית.");
    }
    return normalizeVision(parsed);
  } catch {
    return null;
  }
}

export async function extractFieldsForUpload(
  file: File,
): Promise<{ fields: ExtractedFields; source: string; message: string }> {
  if (file.type.startsWith("image/")) {
    const vision = await extractFieldsFromImage(file);
    if (vision) {
      return {
        fields: vision,
        source: "vision",
        message:
          vision.confidence === "none"
            ? "לא זוהו שדות ברורים בתמונה. מלאו ידנית לפי המסמך."
            : "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.",
      };
    }
  }

  const fields = suggestFromFileName(file.name);
  return {
    fields,
    source: "heuristic",
    message:
      fields.confidence === "none"
        ? "חילוץ אוטומטי מהתמונה אינו זמין כרגע. מלאו את השדות ידנית לפי המסמך."
        : "הוצעו שדות ראשוניים — אשרו ותקנו לפני השמירה.",
  };
}
