import { BuyMeTransport } from "@/lib/buyme/transport";
import { createBuyMeSession } from "@/lib/buyme/session";
import { fetchBuyMeWallet, type BuyMeWalletCard } from "@/lib/buyme/wallet";
import type { NormalizedWalletItem, WalletProvider } from "./types";

export function normalizeBuyMeCard(card: BuyMeWalletCard): NormalizedWalletItem {
  const expired =
    card.expiresAt != null && new Date(card.expiresAt).getTime() <= Date.now();
  let status: NormalizedWalletItem["status"] = "active";
  if (card.used || card.balanceShekels <= 0) status = "used";
  else if (expired) status = "expired";
  const original = card.originalValueShekels ?? card.balanceShekels;
  return {
    provider: "buyme",
    externalId: String(card.id),
    merchant: card.title,
    originalValueShekels: original,
    remainingValueShekels: card.balanceShekels,
    expiresAt: card.expiresAt ? card.expiresAt.slice(0, 10) : null,
    status,
    code: card.code,
    barcode: card.barcode,
    url: card.url,
    shortToken: card.shortToken,
    supplierName: card.supplierName,
    supplierDescription: card.supplierDescription,
    redemptionInstructions: card.redemptionInstructions,
  };
}

export class BuyMeProvider implements WalletProvider {
  readonly id = "buyme" as const;

  constructor(
    private readonly pull: (token: string) => Promise<BuyMeWalletCard[]> = async (
      token,
    ) => {
      const transport = new BuyMeTransport({
        session: createBuyMeSession(token),
      });
      return fetchBuyMeWallet(transport);
    },
  ) {}

  async sync(sessionToken: string): Promise<NormalizedWalletItem[]> {
    const cards = await this.pull(sessionToken);
    return cards.map(normalizeBuyMeCard);
  }
}
