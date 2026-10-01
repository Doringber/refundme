import { shekelsToAgorot } from "./calculations";
import type { ExtractedFields } from "./types";

/**
 * Parse BuyMe "המתנות שלי" list / gift screenshots.
 * One screenshot can contain several gift cards — return candidates for a picker.
 */

export type BuyMeGiftCandidate = {
  /** Display title (Cinema City, BUYME ALL, …) */
  title: string;
  amountAgorot: number | null;
  /** Sender line e.g. מ-Pango */
  fromLabel: string | null;
  relativeMonths: number | null;
  fields: ExtractedFields;
};

const BUYME_PAGE_HINT =
  /buy\s*me|buyme\.co\.il|ביי\s*מי|המתנות\s*שלי|buyme\s*all|buyme\s*foody/i;

/** Known gift titles that appear on BuyMe cards */
const TITLE_PATTERNS: Array<{ match: RegExp; title: string }> = [
  { match: /buyme\s*all/i, title: "BUYME ALL" },
  { match: /buyme\s*foody/i, title: "BUYME FOODY" },
  { match: /סינמה\s*סיטי|cinema\s*city/i, title: "סינמה סיטי" },
  { match: /מתנה\s*לבחירה/i, title: "מתנה לבחירה" },
];

function parseShekelAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return shekelsToAgorot(n);
}

function toFields(candidate: Omit<BuyMeGiftCandidate, "fields">): ExtractedFields {
  const notes = [
    "ייבוא מ־BuyMe — אשרו יתרה לפני שמירה. המימוש באתר / באפליקציית BuyMe או בבית העסק.",
    candidate.fromLabel ? `מאת: ${candidate.fromLabel}` : null,
    candidate.relativeMonths
      ? `צוין זמן בחירה של כ־${candidate.relativeMonths} חודשים — אין תאריך פקיעה מדויק.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const hits = [candidate.title, candidate.amountAgorot].filter(Boolean).length;

  return {
    merchantName: candidate.title,
    documentType: "shopping_voucher",
    amountAgorot: candidate.amountAgorot,
    issueDate: null,
    expiryDate: null,
    voucherCode: null,
    barcodeValue: null,
    usageTerms: "מימוש דרך BuyMe / בית עסק משתתף",
    confidence: hits >= 2 ? "high" : hits >= 1 ? "low" : "none",
    notes,
  };
}

function extractBalanceNear(chunk: string): number | null {
  const patterns = [
    /יתרה\s*[:：]?\s*₪\s*([\d,]+(?:\.\d{1,2})?)/i,
    /יתרה\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)\s*₪/i,
    /יתרה\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const re of patterns) {
    const m = chunk.match(re);
    if (m) {
      const agorot = parseShekelAmount(m[1]);
      if (agorot != null) return agorot;
    }
  }
  return null;
}

function extractRelativeMonths(chunk: string): number | null {
  const m = chunk.match(
    /(?:הזמן\s*שנותר\s*לבחירה|נותר(?:ו)?\s*לבחירה)\s*[:：]?\s*(\d+)\s*חודש/i,
  );
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractFromLabel(chunk: string): string | null {
  const m = chunk.match(
    /מ[-–\s]\s*([A-Za-zא-ת][A-Za-zא-ת0-9 ._-]{1,40})/,
  );
  return m?.[1]?.trim() || null;
}

function detectTitle(chunk: string): string | null {
  for (const entry of TITLE_PATTERNS) {
    if (entry.match.test(chunk)) return entry.title;
  }
  // Line after "ל… מ-…" often is the gift title
  const afterTo = chunk.match(
    /ל[^\n]{2,40}\s*מ[-–][^\n]+\n+\s*([^\n]{2,60})/i,
  );
  if (afterTo?.[1]) {
    const line = afterTo[1].trim();
    if (
      line.length >= 2 &&
      !/יתרה|בחירה|כניסה|מתנות\s*שאפשר/i.test(line) &&
      !/^buyme$/i.test(line)
    ) {
      return line.replace(/\s*[-–].*$/, "").trim() || line;
    }
  }
  return null;
}

/**
 * True when OCR/text looks like a BuyMe gifts screen or gift card.
 */
export function looksLikeBuyMe(text: string): boolean {
  return BUYME_PAGE_HINT.test(text);
}

/**
 * Split a BuyMe "המתנות שלי" OCR dump into gift candidates.
 */
export function extractBuyMeGifts(text: string): BuyMeGiftCandidate[] {
  const normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized || !looksLikeBuyMe(normalized)) return [];

  // Prefer splitting on gift headers: "ל… מ-…" / "ל… מ …"
  const headerRe = /ל[^\n]{1,40}\s*מ[-–\s]\s*[^\n]+/gi;
  const headers = [...normalized.matchAll(headerRe)];
  const chunks: string[] = [];

  if (headers.length >= 1) {
    for (let i = 0; i < headers.length; i += 1) {
      const start = headers[i].index ?? 0;
      const end =
        i + 1 < headers.length
          ? (headers[i + 1].index ?? normalized.length)
          : normalized.length;
      chunks.push(normalized.slice(start, end).trim());
    }
  } else {
    chunks.push(normalized);
  }

  const out: BuyMeGiftCandidate[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const title = detectTitle(chunk);
    if (!title) continue;
    const amountAgorot = extractBalanceNear(chunk);
    const fromLabel = extractFromLabel(chunk);
    const relativeMonths = extractRelativeMonths(chunk);
    const key = `${title}|${amountAgorot ?? "x"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const base = { title, amountAgorot, fromLabel, relativeMonths };
    out.push({ ...base, fields: toFields(base) });
  }

  // Fallback: page mentions BuyMe + a single יתרה but no card title
  if (!out.length) {
    const amountAgorot = extractBalanceNear(normalized);
    if (amountAgorot != null) {
      const base = {
        title: "BuyMe",
        amountAgorot,
        fromLabel: extractFromLabel(normalized),
        relativeMonths: extractRelativeMonths(normalized),
      };
      out.push({ ...base, fields: toFields(base) });
    }
  }

  return out;
}

/**
 * Best single-gift suggestion when OCR looks like BuyMe «המתנות שלי».
 * Returns null for generic BuyMe code screens so the main extractor can keep
 * voucher codes / printed expiry.
 */
export function suggestBuyMeFields(text: string): ExtractedFields | null {
  const gifts = extractBuyMeGifts(text).filter((g) => g.title !== "BuyMe");
  if (!gifts.length) return null;
  const withBalance = gifts.find((g) => g.amountAgorot != null);
  return (withBalance ?? gifts[0]).fields;
}
