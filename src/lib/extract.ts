import type { DocumentType, ExtractedFields } from "./types";
import { shekelsToAgorot } from "./calculations";

/**
 * Lightweight heuristic extraction for demo / offline use.
 * Does not invent barcode or expiry data — only suggests when patterns match.
 * Production can swap this for a server-side OCR provider.
 */
export function suggestFieldsFromText(text: string): ExtractedFields {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return emptyExtraction("none");
  }

  const merchants = [
    "FOX",
    "זארה",
    "ZARA",
    "סופר-פארם",
    "סופרפארם",
    "רמי לוי",
    "איקאה",
    "IKEA",
    "מקס סטוק",
  ];

  let merchantName: string | null = null;
  for (const m of merchants) {
    if (normalized.toLowerCase().includes(m.toLowerCase())) {
      merchantName = m === "ZARA" ? "זארה" : m === "IKEA" ? "איקאה" : m === "סופרפארם" ? "סופר-פארם" : m;
      break;
    }
  }

  let documentType: DocumentType | null = null;
  if (/זיכוי|החזרה|credit/i.test(normalized)) documentType = "store_credit";
  else if (/מתנה|gift/i.test(normalized)) documentType = "gift_voucher";
  else if (/שובר|voucher/i.test(normalized)) documentType = "shopping_voucher";
  else if (/קבלה|חשבונית|receipt|invoice/i.test(normalized)) documentType = "receipt";

  const amountMatch =
    normalized.match(/₪\s*([\d,]+(?:\.\d{1,2})?)/) ||
    normalized.match(/([\d,]+(?:\.\d{1,2})?)\s*ש[״"]?ח/);
  const amountAgorot = amountMatch
    ? shekelsToAgorot(Number(amountMatch[1].replace(/,/g, "")))
    : null;

  const dateMatches = [...normalized.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g)];
  let issueDate: string | null = null;
  let expiryDate: string | null = null;
  if (dateMatches[0]) {
    issueDate = toIsoDate(dateMatches[0][1], dateMatches[0][2], dateMatches[0][3]);
  }
  if (/תוקף|בתוקף עד|valid until|expir/i.test(normalized) && dateMatches.length) {
    const last = dateMatches[dateMatches.length - 1];
    expiryDate = toIsoDate(last[1], last[2], last[3]);
  }

  const codeMatch = normalized.match(
    /(?:קוד|code|מספר שובר)[:\s#]*([A-Z0-9-]{4,})/i,
  );

  const confidence =
    merchantName || amountAgorot || documentType ? "low" : "none";

  return {
    merchantName,
    documentType,
    amountAgorot,
    issueDate,
    expiryDate,
    voucherCode: codeMatch?.[1] ?? null,
    barcodeValue: null,
    usageTerms: null,
    confidence,
    notes:
      confidence === "none"
        ? "לא זוהו שדות אוטומטית — מלאו ידנית"
        : "הצעות בלבד — יש לאשר ולתקן לפני שמירה",
  };
}

function toIsoDate(d: string, m: string, y: string): string {
  const year = y.length === 2 ? `20${y}` : y;
  return `${year.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function emptyExtraction(confidence: ExtractedFields["confidence"]): ExtractedFields {
  return {
    merchantName: null,
    documentType: null,
    amountAgorot: null,
    issueDate: null,
    expiryDate: null,
    voucherCode: null,
    barcodeValue: null,
    usageTerms: null,
    confidence,
    notes: "חילוץ טקסט אינו זמין — מלאו את הפרטים ידנית",
  };
}

/** Demo helper: filename-based soft suggestions without inventing expiry/barcode */
export function suggestFromFileName(fileName: string): ExtractedFields {
  return suggestFieldsFromText(fileName);
}
