import { shekelsToAgorot } from "@/lib/calculations";
import type { ExtractedFields } from "@/lib/types";
import { buyMeHttpsUrl } from "./url";
import { UpstreamError } from "./errors";
import type { BuyMeTransport } from "./transport";

export type BuyMeWalletCard = {
  id: number | string;
  title: string;
  balanceShekels: number;
  originalValueShekels: number | null;
  code: string | null;
  barcode: string | null;
  expiresAt: string | null;
  used: boolean;
  supplierName: string | null;
  url: string | null;
  shortToken: string | null;
  supplierDescription: string | null;
  redemptionInstructions: string | null;
};

const CODE_KEYS = [
  "serialnumber",
  "serial",
  "sn",
  "code",
  "vouchercode",
  "vouchernumber",
  "giftcardcode",
  "cardnumber",
];
const BARCODE_KEYS = ["voucherbarcode", "barcode", "barcodevalue", "barcodenumber"];
const URL_KEYS = ["url", "redeemurl", "voucherurl", "link"];
const TOKEN_KEYS = ["shorttoken"];
const NESTED_KEYS = ["codes", "voucher", "giftcard", "card"];

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function keyIndex(record: Record<string, unknown>): Map<string, unknown> {
  const index = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    index.set(key.toLowerCase().replace(/[_-]/g, ""), value);
  }
  return index;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickFromRecord(
  record: Record<string, unknown>,
  names: string[],
  opts: { allowUrl: boolean; min: number; max: number },
): string | null {
  const index = keyIndex(record);
  for (const name of names) {
    const found = textValue(index.get(name));
    if (!found) continue;
    if (!opts.allowUrl && /^https?:\/\//i.test(found)) continue;
    if (found.length < opts.min || found.length > opts.max) continue;
    return found;
  }
  return null;
}

function pickNested(
  value: unknown,
  names: string[],
  opts: { allowUrl: boolean; min: number; max: number },
  depth = 0,
): string | null {
  if (depth > 3) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickNested(item, names, opts, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  const direct = pickFromRecord(record, names, opts);
  if (direct) return direct;
  const index = keyIndex(record);
  for (const key of NESTED_KEYS) {
    const found = pickNested(index.get(key), names, opts, depth + 1);
    if (found) return found;
  }
  return null;
}

function toShekels(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

const CODE_OPTS = { allowUrl: false, min: 3, max: 80 };
const TOKEN_OPTS = { allowUrl: false, min: 4, max: 120 };
const URL_OPTS = { allowUrl: true, min: 1, max: 500 };

/** Map one BuyMe list (or nested) voucher object. Unknown shapes return null. */
export function normalizeBuyMeVoucherRecord(input: unknown): BuyMeWalletCard | null {
  const raw = asRecord(input);
  if (!raw) return null;
  const index = keyIndex(raw);
  const id = index.get("id");
  if (typeof id !== "number" && typeof id !== "string") return null;
  const balance = toShekels(index.get("amount") ?? index.get("balance"));
  if (balance == null) return null;

  const supplier = asRecord(index.get("supplier"));
  const supplierIndex = supplier ? keyIndex(supplier) : null;
  const supplierName = textValue(supplierIndex?.get("name"));
  const packageRecord = asRecord(index.get("package"));
  const packageIndex = packageRecord ? keyIndex(packageRecord) : null;
  const title = textValue(index.get("title")) || supplierName || "BuyMe";
  const expiresAt = textValue(index.get("expiresat"));

  return {
    id,
    title,
    balanceShekels: balance,
    originalValueShekels: toShekels(index.get("originalvalue")),
    code: pickNested(raw, CODE_KEYS, CODE_OPTS),
    barcode: pickNested(raw, BARCODE_KEYS, CODE_OPTS),
    expiresAt,
    used: Boolean(index.get("used")),
    supplierName,
    url: buyMeHttpsUrl(pickNested(raw, URL_KEYS, URL_OPTS)),
    shortToken: pickNested(raw, TOKEN_KEYS, TOKEN_OPTS),
    supplierDescription: textValue(supplierIndex?.get("description")),
    redemptionInstructions:
      textValue(index.get("selfredeemtext")) ||
      textValue(supplierIndex?.get("smallprint")) ||
      textValue(packageIndex?.get("description")) ||
      textValue(packageIndex?.get("smallprint")),
  };
}

async function fetchVoucherPage(
  transport: BuyMeTransport,
  page: number,
  isUsed: 0 | 1,
  isExpired: 0 | 1,
): Promise<{ vouchers: unknown[]; hasMore: boolean }> {
  const path =
    `/siteapi/vouchers/received?page=${page}&perPage=50` +
    `&isUsed=${isUsed}&isExpired=${isExpired}`;
  const res = await transport.request(path, { method: "GET" });
  if (!res.ok) throw new UpstreamError("HTTP_ERROR", res.status);

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    try {
      json = JSON.parse(Buffer.from(text, "base64").toString("utf8"));
    } catch {
      throw new UpstreamError("INVALID_JSON");
    }
  }

  const body = json as {
    vouchers?: Array<{ data?: unknown }>;
    meta?: { hasMore?: boolean };
  };
  if (!body || !Array.isArray(body.vouchers)) {
    throw new UpstreamError("UNEXPECTED_SHAPE");
  }

  return {
    vouchers: body.vouchers
      .map((v) => v.data)
      .filter((d) => d != null),
    hasMore: Boolean(body.meta?.hasMore),
  };
}

/** Live wallet pull — same endpoint family as buyme-mcp / maccabi-style auth transport. */
export async function fetchBuyMeWallet(
  transport: BuyMeTransport,
  opts: { includeUsed?: boolean; includeExpired?: boolean } = {},
): Promise<BuyMeWalletCard[]> {
  const byId = new Map<string, BuyMeWalletCard>();
  const combos: Array<[0 | 1, 0 | 1]> = [[0, 0]];
  if (opts.includeUsed) combos.push([1, 0]);
  if (opts.includeExpired) combos.push([0, 1]);
  if (opts.includeUsed && opts.includeExpired) combos.push([1, 1]);

  for (const [used, expired] of combos) {
    for (let page = 1; page < 20; page += 1) {
      const { vouchers, hasMore } = await fetchVoucherPage(
        transport,
        page,
        used,
        expired,
      );
      for (const raw of vouchers) {
        const card = normalizeBuyMeVoucherRecord(raw);
        if (!card) continue;
        byId.set(String(card.id), card);
      }
      if (!hasMore) break;
    }
  }

  return [...byId.values()];
}

export function walletCardToFields(card: BuyMeWalletCard): ExtractedFields {
  const expiryIso = card.expiresAt
    ? card.expiresAt.slice(0, 10)
    : null;
  const amountAgorot = shekelsToAgorot(card.balanceShekels);
  return {
    merchantName: card.title,
    documentType: "shopping_voucher",
    amountAgorot,
    issueDate: null,
    expiryDate: expiryIso,
    voucherCode: card.code,
    barcodeValue: card.barcode,
    usageTerms: card.supplierName
      ? `BuyMe · ${card.supplierName}`
      : "מימוש דרך BuyMe",
    confidence: amountAgorot > 0 && card.code ? "high" : "low",
    notes: [
      "יובא מארנק BuyMe המחובר (API).",
      card.url ? `קישור: ${card.url}` : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function activeImportableCards(cards: BuyMeWalletCard[]): BuyMeWalletCard[] {
  return cards.filter((c) => !c.used && c.balanceShekels > 0);
}
