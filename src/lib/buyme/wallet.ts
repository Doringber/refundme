import { shekelsToAgorot } from "@/lib/calculations";
import type { ExtractedFields } from "@/lib/types";
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
};

type RawVoucherData = {
  id?: number | string;
  title?: string;
  amount?: number;
  originalValue?: number;
  serialnumber?: string;
  voucherBarcode?: string | null;
  shortToken?: string | null;
  expiresAt?: string | null;
  used?: boolean;
  supplier?: { name?: string } | null;
  url?: string | null;
};

function toShekels(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function normalizeCard(raw: RawVoucherData): BuyMeWalletCard | null {
  if (raw.id == null) return null;
  const balance = toShekels(raw.amount);
  if (balance == null) return null;
  const title = (raw.title || raw.supplier?.name || "BuyMe").trim();
  return {
    id: raw.id,
    title,
    balanceShekels: balance,
    originalValueShekels: toShekels(raw.originalValue),
    code: raw.serialnumber?.trim() || null,
    barcode: raw.voucherBarcode?.trim() || null,
    expiresAt: raw.expiresAt ?? null,
    used: Boolean(raw.used),
    supplierName: raw.supplier?.name?.trim() || null,
    url: raw.url ?? null,
  };
}

async function fetchVoucherPage(
  transport: BuyMeTransport,
  page: number,
  isUsed: 0 | 1,
  isExpired: 0 | 1,
): Promise<{ vouchers: RawVoucherData[]; hasMore: boolean }> {
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
    vouchers?: Array<{ data?: RawVoucherData }>;
    meta?: { hasMore?: boolean };
  };
  if (!body || !Array.isArray(body.vouchers)) {
    throw new UpstreamError("UNEXPECTED_SHAPE");
  }

  return {
    vouchers: body.vouchers
      .map((v) => v.data)
      .filter((d): d is RawVoucherData => Boolean(d)),
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
        const card = normalizeCard(raw);
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
