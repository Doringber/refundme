import { NextResponse } from "next/server";
import { packBuyMeExtension } from "@/lib/buyme/extension-pack";

export const runtime = "nodejs";

/** Download the Chrome extension that captures the user's own BuyMe session. */
export function GET() {
  const zip = packBuyMeExtension();
  if (!zip) {
    return NextResponse.json({ error: "extension_missing" }, { status: 500 });
  }
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="zikuy-buyme-connect.zip"',
      "cache-control": "no-store",
    },
  });
}
