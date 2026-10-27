import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/constants";
import { mapVoucher } from "@/lib/data/mappers";
import { isDemoModeFromCookie } from "@/lib/demo/mode";
import { lookupMerchant } from "@/lib/stores/nearby-service";
import { NEARBY_BUDGET_MS } from "@/lib/stores/search";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  applePassMode,
  buildStoreCardPass,
  parseCreditSnapshot,
  parseOrigin,
  snapshotFromVoucher,
  UNSIGNED_PASS_TYPE,
  UNSIGNED_TEAM_ID,
  type CreditSnapshot,
  type PassPin,
} from "@/lib/wallet/apple-pass";
import { readPassCertificates, signStorePass } from "@/lib/wallet/apple-pass-sign";

export const runtime = "nodejs";
export const maxDuration = 10;

const PASS_MAX_KM = 250;

function html(status: number, message: string) {
  const safe = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Apple Wallet</title><p>${safe}</p><p><a href="javascript:history.back()">חזרה</a></p>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

async function ownedCredit(id: string): Promise<CreditSnapshot | null> {
  if (!isSupabaseConfigured() || id.length > 80) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from("vouchers").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return snapshotFromVoucher(mapVoucher(data));
  } catch {
    return null;
  }
}

async function pinsFor(
  merchantName: string,
  origin: { lat: number; lng: number } | null,
): Promise<PassPin[]> {
  if (!origin) return [];
  const payload = await lookupMerchant({
    merchantName,
    origin,
    deadline: Date.now() + NEARBY_BUDGET_MS,
    mayPersist: async () => false,
    includeCoordinates: true,
    placeLimit: 10,
    maxKm: PASS_MAX_KM,
  });
  return payload.places.flatMap((place) =>
    place.lat == null || place.lng == null
      ? []
      : [{ name: place.name, lat: place.lat, lng: place.lng, distanceKm: place.distanceKm }],
  );
}

async function deliver(credit: CreditSnapshot, origin: { lat: number; lng: number } | null) {
  const mode = applePassMode();
  if (mode === "hidden") return html(404, "ההוספה ל-Apple Wallet לא מוגדרת בשרת.");
  const pins = await pinsFor(credit.merchantName, origin);
  const identifiers =
    mode === "signed"
      ? {
          passTypeIdentifier: process.env.PASS_TYPE_IDENTIFIER!.trim(),
          teamIdentifier: process.env.APPLE_TEAM_ID!.trim(),
        }
      : { passTypeIdentifier: UNSIGNED_PASS_TYPE, teamIdentifier: UNSIGNED_TEAM_ID };
  const definition = buildStoreCardPass({ credit, pins, ...identifiers });
  if (mode === "unsigned") {
    return new NextResponse(JSON.stringify(definition, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="zikuy-pass.json"',
        "cache-control": "no-store",
        "x-pass-unsigned": "1",
      },
    });
  }
  try {
    const buffer = signStorePass(definition, readPassCertificates());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.apple.pkpass",
        "content-disposition": 'attachment; filename="zikuy.pkpass"',
        "cache-control": "no-store",
      },
    });
  } catch {
    return html(500, "חתימת הכרטיס נכשלה. בדקו את תעודת ה-Pass Type ID ואת הסיסמה של המפתח.");
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const voucherId = params.get("voucherId")?.trim() ?? "";
  if (!voucherId) {
    return NextResponse.json({ mode: applePassMode() }, { headers: { "cache-control": "no-store" } });
  }
  const mode = applePassMode();
  if (mode === "hidden") return html(404, "ההוספה ל-Apple Wallet לא מוגדרת בשרת.");
  const credit = await ownedCredit(voucherId);
  if (!credit) {
    return html(
      404,
      mode === "unsigned"
        ? "הזיכוי לא נמצא בחשבון. במצב דמו בלי חתימה השתמשו בכפתור ששולח את פרטי הזיכוי."
        : "הזיכוי לא נמצא בחשבון, או שאין יתרה להוסיף ל-Wallet.",
    );
  }
  return deliver(credit, parseOrigin(params.get("lat"), params.get("lng")));
}

export async function POST(request: Request) {
  const mode = applePassMode();
  if (mode === "hidden") return html(404, "ההוספה ל-Apple Wallet לא מוגדרת בשרת.");
  let body: Record<string, unknown> = {};
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const parsed = (await request.json()) as unknown;
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } else {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") body[key] = value;
      }
      if (typeof body.remainingAmountAgorot === "string") {
        body.remainingAmountAgorot = Number(body.remainingAmountAgorot);
      }
    }
  } catch {
    return html(400, "הבקשה לא קריאה.");
  }

  const voucherId = typeof body.voucherId === "string" ? body.voucherId.trim() : "";
  const owned = voucherId ? await ownedCredit(voucherId) : null;
  if (owned) return deliver(owned, parseOrigin(body.lat, body.lng));

  const demo = isDemoModeFromCookie(request.headers.get("cookie"));
  const cookieDemo = (request.headers.get("cookie") ?? "").includes(`${DEMO_COOKIE}=1`);
  if (mode !== "unsigned" || (!demo && !cookieDemo)) {
    return html(401, "התחברו כדי להוסיף זיכוי חתום ל-Apple Wallet.");
  }
  const credit = parseCreditSnapshot({
    id: body.id ?? body.voucherId,
    merchantName: body.merchantName,
    documentType: body.documentType,
    remainingAmountAgorot: body.remainingAmountAgorot,
    expiryDate: body.expiryDate || null,
    expiryConfidence: body.expiryConfidence,
    voucherCode: body.voucherCode || null,
    barcodeValue: body.barcodeValue || null,
    usageTerms: body.usageTerms || null,
  });
  if (!credit) return html(400, "אפשר להוסיף ל-Wallet רק זיכוי עם יתרה. קבלה לא נכנסת.");
  return deliver(credit, parseOrigin(body.lat, body.lng));
}
