import type { DocumentType, ExtractedFields } from "./types";
import { suggestFieldsFromText } from "./extract";

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

const SYSTEM_PROMPT = `You OCR and extract fields from Israeli retail credit vouchers and receipts (thermal paper photos).
Common Hebrew labels:
- תעודת זיכוי / שובר זיכוי → documentType store_credit
- חשבונית קבלה → documentType receipt (NOT store credit)
- סה"כ זיכוי → amountShekels (the credit total, not VAT/net lines)
- תאריך הפקה / תאריך הנפקה → issueDate
- תוקף השובר DD/MM/YY → expiryDate
- If text says תוקף לשנתיים מיום מסירתה with NO printed date → expiryDate null
- שובר זיכוי : 27309137 → voucherCode
- תעודת זיכוי מס' 1-117-07-046638 → voucherCode
- Barcode digits under the barcode (e.g. 999027309137) → barcodeValue
Merchants: שופרסל, סופר-פארם, יוחננוף, FOX, זארה, רמי לוי, איקאה

Return ONLY valid JSON:
merchantName, documentType, amountShekels, issueDate, expiryDate, voucherCode, barcodeValue, usageTerms, rawText
Rules:
- documentType one of: store_credit, gift_voucher, shopping_voucher, receipt, or null
- Dates YYYY-MM-DD only when clearly printed
- Never invent barcode, code, amount, or expiry — null if unsure
- amountShekels in shekels (e.g. 19.9 or 35.2), not agorot
- Prefer Hebrew merchant names
- rawText: key printed lines transcribed`;

function mergeFields(
  primary: ExtractedFields,
  secondary: ExtractedFields | null,
): ExtractedFields {
  if (!secondary) return primary;
  return {
    merchantName: primary.merchantName ?? secondary.merchantName,
    documentType: primary.documentType ?? secondary.documentType,
    amountAgorot: primary.amountAgorot ?? secondary.amountAgorot,
    issueDate: primary.issueDate ?? secondary.issueDate,
    expiryDate: primary.expiryDate ?? secondary.expiryDate,
    voucherCode: primary.voucherCode ?? secondary.voucherCode,
    barcodeValue: primary.barcodeValue ?? secondary.barcodeValue,
    usageTerms: primary.usageTerms ?? secondary.usageTerms,
    confidence:
      primary.confidence === "high" || secondary.confidence === "high"
        ? "high"
        : primary.confidence === "low" || secondary.confidence === "low"
          ? "low"
          : "none",
    notes: primary.notes ?? secondary.notes,
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

  const fromVision: ExtractedFields = {
    merchantName: json.merchantName ?? null,
    documentType,
    amountAgorot,
    issueDate: json.issueDate ?? null,
    expiryDate: json.expiryDate ?? null,
    voucherCode: json.voucherCode ?? null,
    barcodeValue: json.barcodeValue ?? null,
    usageTerms: json.usageTerms ?? null,
    confidence:
      json.merchantName || amountAgorot || documentType ? "low" : "none",
    notes: "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.",
  };

  const fromText = json.rawText ? suggestFieldsFromText(json.rawText) : null;
  const merged = mergeFields(fromVision, fromText);
  if (merged.confidence !== "none") {
    merged.notes = "הוצעו שדות מהתמונה — אשרו ותקנו לפני השמירה.";
  }
  return merged;
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

export function canUseVisionExtraction(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_BASE_URL,
  );
}

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
    if (!parsed) return null;
    return normalizeVision(parsed);
  } catch {
    return null;
  }
}
