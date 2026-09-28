import type { DocumentType, ExtractedFields } from "./types";
import { shekelsToAgorot } from "./calculations";

/**
 * Heuristic extraction for Israeli store-credit vouchers and receipts.
 * Only suggests fields when patterns match — never invents barcode/expiry.
 */

const MERCHANT_ALIASES: Array<{ match: RegExp; name: string }> = [
  { match: /שופרסל/i, name: "שופרסל" },
  { match: /סופר[-\s]?פארם|super[\s-]?pharm/i, name: "סופר-פארם" },
  { match: /יוחננוף|yochananof/i, name: "יוחננוף" },
  { match: /\bFOX\b/i, name: "FOX" },
  { match: /זארה|\bZARA\b/i, name: "זארה" },
  { match: /רמי\s*לוי/i, name: "רמי לוי" },
  { match: /איקאה|\bIKEA\b/i, name: "איקאה" },
  { match: /מקס\s*סטוק/i, name: "מקס סטוק" },
];

function emptyExtraction(
  confidence: ExtractedFields["confidence"],
  notes?: string,
): ExtractedFields {
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
    notes:
      notes ??
      (confidence === "none"
        ? "לא זוהו שדות אוטומטית — מלאו ידנית"
        : "הצעות בלבד — יש לאשר ולתקן לפני שמירה"),
  };
}

function toIsoDate(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y.length === 2 ? `20${y}` : y);
  if (!day || !month || !year) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseShekelAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return shekelsToAgorot(n);
}

function detectMerchant(text: string): string | null {
  for (const entry of MERCHANT_ALIASES) {
    if (entry.match.test(text)) return entry.name;
  }
  return null;
}

function detectDocumentType(text: string): DocumentType | null {
  // Credit vouchers first (more specific than generic "שובר")
  if (
    /תעודת\s*זיכוי|שובר\s*זיכוי|סה["״']?\s*כ\s*זיכוי|סה״כ\s*זיכוי|סה"כ\s*זיכוי/i.test(
      text,
    )
  ) {
    return "store_credit";
  }
  if (/שובר\s*מתנה|gift\s*voucher/i.test(text)) return "gift_voucher";
  if (/חשבונית\s*קבלה|קבלה\s*מס|invoice\s*receipt/i.test(text)) {
    return "receipt";
  }
  if (/זיכוי|החזרה|store\s*credit/i.test(text)) return "store_credit";
  if (/שובר|voucher/i.test(text)) return "shopping_voucher";
  if (/קבלה|חשבונית|receipt/i.test(text)) return "receipt";
  return null;
}

function extractCreditAmount(text: string): number | null {
  const patterns = [
    /סה["״']?\s*כ\s*זיכוי\s*[-–:]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /סה״כ\s*זיכוי\s*[-–:]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /סה"כ\s*זיכוי\s*[-–:]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /סה["״']?\s*כ\s*זיכוי[^\d]{0,12}([\d,]+(?:\.\d{1,2})?)\s*ש/i,
    /Total\s*Credit\s*[-–:]?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const agorot = parseShekelAmount(m[1]);
      if (agorot != null) return agorot;
    }
  }

  // Super-Pharm style: line "סה״כ זיכוי" then amount nearby
  const lineHit = text.match(
    /סה["״']?\s*כ\s*זיכוי[\s\S]{0,40}?([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (lineHit) {
    const agorot = parseShekelAmount(lineHit[1]);
    if (agorot != null) return agorot;
  }

  // Generic shekel amount only as weak fallback when credit voucher detected
  const generic =
    text.match(/₪\s*([\d,]+(?:\.\d{1,2})?)/) ||
    text.match(/([\d,]+(?:\.\d{1,2})?)\s*ש[״"']?ח/);
  if (generic) return parseShekelAmount(generic[1]);
  return null;
}

function extractReceiptTotal(text: string): number | null {
  const patterns = [
    /סה["״']?\s*כ\s*לשלם\s*[-–:]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /סה["״']?\s*כ\s*[-–:]?\s*([\d,]+(?:\.\d{1,2})?)\s*ש/i,
    /לתשלום\s*[-–:]?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const agorot = parseShekelAmount(m[1]);
      if (agorot != null) return agorot;
    }
  }
  return null;
}

function extractVoucherCode(text: string): string | null {
  const patterns = [
    /תעודת\s*זיכוי\s*מס['׳']?\s*([0-9][0-9\-./]{5,})/i,
    /שובר\s*זיכוי\s*[:：]?\s*([0-9]{5,})/i,
    /(?:קוד|code|מספר שובר)\s*[:：#]?\s*([A-Z0-9-]{4,})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractBarcode(text: string): string | null {
  // Prefer long numeric strings typical of retail barcodes (EAN/UPC-like)
  const candidates = [...text.matchAll(/\b(\d{8,14})\b/g)].map((m) => m[1]);
  if (!candidates.length) return null;
  // Prefer ones starting with 729 (Israel) or 999 (common Super-Pharm voucher barcodes)
  const preferred =
    candidates.find((c) => c.startsWith("999")) ||
    candidates.find((c) => c.startsWith("729")) ||
    candidates[candidates.length - 1];
  return preferred ?? null;
}

function extractIssueDate(text: string): string | null {
  const labeled = text.match(
    /תאריך\s*(?:הפקה|הנפקה|מסירה)?\s*[:：]?\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/i,
  );
  if (labeled) return toIsoDate(labeled[1], labeled[2], labeled[3]);
  return null;
}

function extractExpiryDate(text: string): {
  date: string | null;
  relativeYears: number | null;
} {
  const labeled = text.match(
    /תוקף(?:\s*השובר|\s*תעודת\s*הזיכוי)?\s*[:：]?\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/i,
  );
  if (labeled) {
    return {
      date: toIsoDate(labeled[1], labeled[2], labeled[3]),
      relativeYears: null,
    };
  }

  // "תוקף ... לשנתיים מיום מסירתה" — relative, do not invent a calendar date
  if (/תוקף[^\n.]{0,40}שנתיים/i.test(text)) {
    return { date: null, relativeYears: 2 };
  }
  if (/תוקף[^\n.]{0,40}שנה\b/i.test(text)) {
    return { date: null, relativeYears: 1 };
  }
  return { date: null, relativeYears: null };
}

function extractUsageTerms(text: string): string | null {
  const snippets: string[] = [];
  if (/למימוש בכל סניפי/i.test(text)) {
    snippets.push("ניתן למימוש בכל סניפי הרשת");
  } else if (/ניתן לממש את התעודה בסניפי/i.test(text)) {
    snippets.push("ניתן למימוש בסניפי הרשת");
  }
  if (/ללא תנאים מגבילים/i.test(text)) {
    snippets.push("ללא תנאים מגבילים");
  }
  if (/תוקף[^\n.]{0,40}שנתיים/i.test(text)) {
    snippets.push("תוקף לשנתיים מיום המסירה");
  }
  return snippets.length ? snippets.join(" · ") : null;
}

export function suggestFieldsFromText(text: string): ExtractedFields {
  const normalized = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return emptyExtraction("none");

  const merchantName = detectMerchant(normalized);
  const documentType = detectDocumentType(normalized);
  const isCredit =
    documentType === "store_credit" ||
    documentType === "gift_voucher" ||
    documentType === "shopping_voucher";

  const amountAgorot = isCredit
    ? extractCreditAmount(normalized)
    : documentType === "receipt"
      ? extractReceiptTotal(normalized)
      : extractCreditAmount(normalized) ?? extractReceiptTotal(normalized);

  const issueDate = extractIssueDate(normalized);
  const expiry = extractExpiryDate(normalized);
  const voucherCode = extractVoucherCode(normalized);
  const barcodeValue = extractBarcode(normalized);
  const usageTerms = extractUsageTerms(normalized);

  let notes: string | null = null;
  if (expiry.relativeYears && !expiry.date) {
    notes = `מצוין תוקף של ${expiry.relativeYears === 2 ? "שנתיים" : "שנה"} מיום המסירה — אין תאריך מודפס. אשרו תוקף ידנית או סמנו כלא מאומת.`;
  }

  const hits = [
    merchantName,
    documentType,
    amountAgorot,
    issueDate,
    expiry.date,
    voucherCode,
    barcodeValue,
  ].filter(Boolean).length;

  const confidence: ExtractedFields["confidence"] =
    hits >= 4 ? "high" : hits >= 1 ? "low" : "none";

  return {
    merchantName,
    documentType,
    amountAgorot,
    issueDate,
    expiryDate: expiry.date,
    voucherCode,
    barcodeValue:
      // Don't treat short voucher codes as barcodes when they already filled voucherCode
      barcodeValue && barcodeValue !== voucherCode?.replace(/\D/g, "")
        ? barcodeValue
        : barcodeValue,
    usageTerms,
    confidence,
    notes:
      notes ??
      (confidence === "none"
        ? "לא זוהו שדות אוטומטית — מלאו ידנית"
        : "הצעות בלבד — יש לאשר ולתקן לפני שמירה"),
  };
}

/** Filename-based soft suggestions without inventing expiry/barcode */
export function suggestFromFileName(fileName: string): ExtractedFields {
  return suggestFieldsFromText(fileName);
}
