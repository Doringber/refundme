import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ReauthenticationRequired } from "@/lib/buyme/errors";
import { getSecretKey } from "@/lib/supabase/secret";
import { BuyMeProvider } from "./buyme-provider";
import {
  markBuyMeLoginRequired,
  readBuyMeToken,
  touchBuyMeSync,
} from "./connection-store";
import type { WalletSyncReport } from "./types";
import { planBuyMeUpserts, type ExistingBuyMeVoucher } from "./upsert-plan";

async function admin() {
  const key = getSecretKey();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function syncBuyMeWallet(
  userId: string,
  token: string,
  provider = new BuyMeProvider(),
): Promise<WalletSyncReport> {
  const db = await admin();
  if (!db) {
    return { provider: "buyme", status: "error", upserted: 0, error: "server_unconfigured" };
  }
  let items;
  try {
    items = await provider.sync(token);
  } catch (err) {
    if (err instanceof ReauthenticationRequired) {
      await markBuyMeLoginRequired(userId, "session_expired");
      return { provider: "buyme", status: "login_required", upserted: 0 };
    }
    return {
      provider: "buyme",
      status: "error",
      upserted: 0,
      error: "wallet_fetch_failed",
    };
  }

  const { data: existingRows, error: readError } = await db
    .from("vouchers")
    .select("id, extraction_raw")
    .eq("user_id", userId)
    .eq("extraction_raw->>provider", "buyme");
  if (readError) {
    return { provider: "buyme", status: "error", upserted: 0, error: "read_failed" };
  }
  const existing: ExistingBuyMeVoucher[] = (existingRows ?? [])
    .map((row) => {
      const raw = row.extraction_raw as { externalId?: string } | null;
      return raw?.externalId ? { id: row.id as string, externalId: raw.externalId } : null;
    })
    .filter((row): row is ExistingBuyMeVoucher => Boolean(row));

  const plan = planBuyMeUpserts(existing, items);
  let upserted = 0;
  if (plan.inserts.length) {
    const { error } = await db.from("vouchers").insert(
      plan.inserts.map((row) => ({ ...row, user_id: userId })),
    );
    if (error) {
      return { provider: "buyme", status: "error", upserted: 0, error: "insert_failed" };
    }
    upserted += plan.inserts.length;
  }
  for (const row of plan.updates) {
    const { id, ...patch } = row;
    const { error } = await db
      .from("vouchers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      return { provider: "buyme", status: "error", upserted, error: "update_failed" };
    }
    upserted += 1;
  }
  await touchBuyMeSync(userId);
  return { provider: "buyme", status: "synced", upserted };
}

export async function syncBuyMeForStoredSession(userId: string): Promise<WalletSyncReport> {
  const token = await readBuyMeToken(userId);
  if (!token) {
    return { provider: "buyme", status: "login_required", upserted: 0 };
  }
  return syncBuyMeWallet(userId, token);
}
