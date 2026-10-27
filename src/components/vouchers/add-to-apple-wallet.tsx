"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/lib/app-data/context";
import type { Voucher } from "@/lib/types";
import {
  isWalletCredit,
  showAppleWalletButton,
  type ApplePassMode,
} from "@/lib/wallet/apple-pass";

/**
 * Second action on the voucher screen. Hidden until the server has a Pass
 * Type ID certificate, or until PASS_DEV_UNSIGNED=1 for a local JSON draft.
 */
export function AddToAppleWallet({ voucher }: { voucher: Voucher }) {
  const app = useAppData();
  const [mode, setMode] = useState<ApplePassMode>("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isWalletCredit(voucher)) return;
    let cancelled = false;
    void fetch("/api/wallet/apple")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { mode?: ApplePassMode } | null) => {
        if (cancelled) return;
        setMode(body?.mode === "signed" || body?.mode === "unsigned" ? body.mode : "hidden");
      })
      .catch(() => {
        if (!cancelled) setMode("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, [voucher]);

  if (
    !showAppleWalletButton({
      passMode: mode,
      appMode: app.mode,
      documentType: voucher.documentType,
      remainingAmountAgorot: voucher.remainingAmountAgorot,
    })
  ) {
    return null;
  }

  async function add() {
    setBusy(true);
    const position = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
      );
    });

    if (mode === "signed") {
      const url = new URL("/api/wallet/apple", window.location.origin);
      url.searchParams.set("voucherId", voucher.id);
      if (position) {
        url.searchParams.set("lat", String(position.lat));
        url.searchParams.set("lng", String(position.lng));
      }
      window.location.assign(url.toString());
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/wallet/apple";
    const fields: Record<string, string> = {
      voucherId: voucher.id,
      id: voucher.id,
      merchantName: voucher.merchantName,
      documentType: voucher.documentType,
      remainingAmountAgorot: String(voucher.remainingAmountAgorot),
      expiryDate: voucher.expiryDate ?? "",
      expiryConfidence: voucher.expiryConfidence,
      voucherCode: voucher.voucherCode ?? "",
      barcodeValue: voucher.barcodeValue ?? "",
      usageTerms: voucher.usageTerms ?? "",
    };
    if (position) {
      fields.lat = String(position.lat);
      fields.lng = String(position.lng);
    }
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-secondary flex w-full items-center justify-center text-base"
        data-testid="add-apple-wallet"
        disabled={busy}
        onClick={() => void add()}
      >
        {busy ? "מאתרים סניפים…" : "הוספה ל-Apple Wallet"}
      </button>
      {mode === "unsigned" ? (
        <p className="text-center text-xs font-semibold text-eggplant">
          טיוטה בלי חתימה. Wallet יסרב לקובץ עד שתוגדר תעודה.
        </p>
      ) : null}
    </div>
  );
}
