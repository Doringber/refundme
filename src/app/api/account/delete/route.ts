import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { logServerError } from "@/lib/log";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSecretKey } from "@/lib/supabase/secret";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PAGE = 100;

type StorageBucket = ReturnType<SupabaseClient["storage"]["from"]>;

async function listAll(
  bucket: StorageBucket,
  prefix: string,
): Promise<{ names: { name: string; folder: boolean }[] } | { error: string }> {
  const names: { name: string; folder: boolean }[] = [];
  for (let offset = 0; offset < 10_000; offset += PAGE) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE, offset });
    if (error) return { error: error.message };
    if (!data?.length) break;
    for (const entry of data) {
      if (!entry.name || entry.name === "." || entry.name === "..") continue;
      names.push({ name: entry.name, folder: entry.id == null });
    }
    if (data.length < PAGE) break;
  }
  return { names };
}

async function removeUserDocuments(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const bucket = admin.storage.from("voucher-documents");
  const top = await listAll(bucket, userId);
  if ("error" in top) return top.error;

  const paths: string[] = [];
  for (const entry of top.names) {
    const prefix = `${userId}/${entry.name}`;
    if (!entry.folder) {
      paths.push(prefix);
      continue;
    }
    const nested = await listAll(bucket, prefix);
    if ("error" in nested) return nested.error;
    for (const file of nested.names) {
      if (file.folder) continue;
      paths.push(`${prefix}/${file.name}`);
    }
  }

  for (let i = 0; i < paths.length; i += PAGE) {
    const chunk = paths.slice(i, i + PAGE);
    const { error } = await bucket.remove(chunk);
    if (error) return error.message;
  }
  return null;
}

function failed(scope: string, detail: string) {
  logServerError(scope, detail);
  return NextResponse.json({ error: "מחיקת החשבון נכשלה" }, { status: 500 });
}

/**
 * Deletes the authenticated user's documents, rows, and auth account.
 * Requires SUPABASE_SECRET_KEY (or legacy SERVICE_ROLE) on the server only.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "במצב דמו מחקו את הנתונים מההגדרות בדפדפן." },
      { status: 400 },
    );
  }

  const serviceKey = getSecretKey();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      { error: "מפתח secret אינו מוגדר בשרת" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחוברים" }, { status: 401 });
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const storageError = await removeUserDocuments(admin, user.id);
  if (storageError) return failed("account-delete", storageError);

  const byUserId = [
    "activity_events",
    "redemptions",
    "vouchers",
    "wallet_connections",
  ] as const;
  for (const table of byUserId) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) return failed("account-delete", `${table}: ${error.message}`);
  }

  const profile = await admin.from("profiles").delete().eq("id", user.id);
  if (profile.error) return failed("account-delete", profile.error.message);

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) return failed("account-delete", authError.message);

  return NextResponse.json({ ok: true });
}
