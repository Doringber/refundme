import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSecretKey, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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
  if (!serviceKey) {
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Remove storage objects under user folder
  const { data: files } = await admin.storage
    .from("voucher-documents")
    .list(user.id, { limit: 1000 });
  if (files?.length) {
    for (const folder of files) {
      const { data: nested } = await admin.storage
        .from("voucher-documents")
        .list(`${user.id}/${folder.name}`, { limit: 100 });
      const paths =
        nested?.map((f) => `${user.id}/${folder.name}/${f.name}`) ?? [];
      if (paths.length) {
        await admin.storage.from("voucher-documents").remove(paths);
      }
    }
  }

  await admin.from("activity_events").delete().eq("user_id", user.id);
  await admin.from("redemptions").delete().eq("user_id", user.id);
  await admin.from("vouchers").delete().eq("user_id", user.id);
  await admin.from("profiles").delete().eq("id", user.id);
  await admin.auth.admin.deleteUser(user.id);

  return NextResponse.json({ ok: true });
}
