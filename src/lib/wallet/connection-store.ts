import "server-only";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSecretKey } from "@/lib/supabase/secret";
import { decryptSessionToken, encryptSessionToken, sessionEncryptionSecret } from "./session-crypto";

export type ConnectionStatus = "connected" | "login_required";

function admin(): SupabaseClient | null {
  const key = getSecretKey();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function saveBuyMeConnection(input: {
  userId: string;
  token: string;
  expiresAt: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = admin();
  const secret = sessionEncryptionSecret();
  if (!db || !secret) return { ok: false, reason: "server_unconfigured" };
  const ciphertext = encryptSessionToken(input.token, secret);
  const { data, error } = await db
    .from("wallet_connections")
    .upsert(
      {
        user_id: input.userId,
        provider: "buyme",
        status: "connected",
        expires_at: input.expiresAt,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .single();
  if (error || !data?.id) return { ok: false, reason: error?.message ?? "upsert_failed" };
  const secretWrite = await db.from("wallet_connection_secrets").upsert({
    connection_id: data.id,
    token_ciphertext: ciphertext,
    updated_at: new Date().toISOString(),
  });
  if (secretWrite.error) return { ok: false, reason: secretWrite.error.message };
  return { ok: true };
}

export async function markBuyMeLoginRequired(userId: string, reason: string): Promise<void> {
  const db = admin();
  if (!db) return;
  await db
    .from("wallet_connections")
    .update({
      status: "login_required",
      last_error: reason.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "buyme");
}

export async function readBuyMeToken(userId: string): Promise<string | null> {
  const db = admin();
  const secret = sessionEncryptionSecret();
  if (!db || !secret) return null;
  const { data: conn } = await db
    .from("wallet_connections")
    .select("id,status")
    .eq("user_id", userId)
    .eq("provider", "buyme")
    .maybeSingle();
  if (!conn || conn.status !== "connected") return null;
  const { data: sec } = await db
    .from("wallet_connection_secrets")
    .select("token_ciphertext")
    .eq("connection_id", conn.id)
    .maybeSingle();
  if (!sec?.token_ciphertext) return null;
  try {
    return decryptSessionToken(sec.token_ciphertext, secret);
  } catch {
    return null;
  }
}

export async function touchBuyMeSync(userId: string): Promise<void> {
  const db = admin();
  if (!db) return;
  await db
    .from("wallet_connections")
    .update({
      status: "connected",
      last_synced_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "buyme");
}

/** Drop the stored BuyMe session so cron cannot keep syncing after disconnect. */
export async function disconnectBuyMeConnection(userId: string): Promise<boolean> {
  const db = admin();
  if (!db) return false;
  const { error } = await db
    .from("wallet_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "buyme");
  return !error;
}

export async function listConnectedBuyMeUserIds(): Promise<string[]> {
  const db = admin();
  if (!db) return [];
  const { data } = await db
    .from("wallet_connections")
    .select("user_id")
    .eq("provider", "buyme")
    .eq("status", "connected");
  return (data ?? []).map((row) => row.user_id as string);
}
