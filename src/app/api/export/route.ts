import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { mapActivity, mapRedemption, mapVoucher } from "@/lib/data/mappers";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "במצב דמו הייצוא מתבצע מהדפדפן. התחברו ל־Supabase לייצוא מהשרת.",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחוברים" }, { status: 401 });
  }

  const [vouchers, redemptions, activity] = await Promise.all([
    supabase.from("vouchers").select("*").eq("user_id", user.id),
    supabase.from("redemptions").select("*").eq("user_id", user.id),
    supabase.from("activity_events").select("*").eq("user_id", user.id),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    balanceLabel: "יתרה לפי הדיווח שלך",
    userId: user.id,
    vouchers: (vouchers.data ?? []).map(mapVoucher),
    redemptions: (redemptions.data ?? []).map(mapRedemption),
    activity: (activity.data ?? []).map(mapActivity),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="zikuy-sheli-export.json"`,
    },
  });
}
