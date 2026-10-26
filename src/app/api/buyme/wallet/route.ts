import { NextResponse } from "next/server";
import { clearBuyMeSessionCookie, readBuyMeSessionCookie } from "@/lib/buyme/cookie";
import { ReauthenticationRequired } from "@/lib/buyme/errors";
import { logServerError } from "@/lib/log";
import { BuyMeTransport } from "@/lib/buyme/transport";
import {
  activeImportableCards,
  fetchBuyMeWallet,
  walletCardToFields,
} from "@/lib/buyme/wallet";

export const runtime = "nodejs";

/**
 * Pull the signed-in user's BuyMe wallet via private `/siteapi`
 * (Bearer transport — same approach as maccabi-health + buyme-mcp).
 */
export async function GET() {
  const session = await readBuyMeSessionCookie();
  if (!session) {
    return NextResponse.json(
      { status: "NEEDS_REAUTH", error: "not_connected" },
      { status: 401 },
    );
  }

  const transport = new BuyMeTransport({ session });
  try {
    const cards = await fetchBuyMeWallet(transport);
    const active = activeImportableCards(cards);
    return NextResponse.json({
      status: "OK",
      count: active.length,
      totalBalanceShekels: active.reduce((s, c) => s + c.balanceShekels, 0),
      cards: active.map((c) => ({
        ...c,
        fields: walletCardToFields(c),
      })),
      expiresAt: session.expiresAtMs
        ? new Date(session.expiresAtMs).toISOString()
        : null,
    });
  } catch (err) {
    if (err instanceof ReauthenticationRequired) {
      await clearBuyMeSessionCookie();
      return NextResponse.json(
        { status: "NEEDS_REAUTH", error: "reauth_required" },
        { status: 401 },
      );
    }
    logServerError("buyme-wallet", err);
    return NextResponse.json(
      { status: "ERROR", error: "wallet_fetch_failed" },
      { status: 502 },
    );
  }
}
