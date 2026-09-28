"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatIls } from "@/lib/calculations";
import { useAppData } from "@/lib/app-data/context";
import type { Voucher } from "@/lib/types";
import { ExpiryBadge, StatusBadge, TypeBadge } from "@/components/ui/status-badge";

export function VoucherCard({ voucher }: { voucher: Voucher }) {
  const app = useAppData();
  const isReceipt = voucher.documentType === "receipt";
  const [remoteThumb, setRemoteThumb] = useState<string | null>(null);
  const thumb =
    voucher.documentDataUrl ??
    (voucher.documentMimeType?.startsWith("image/") ? remoteThumb : null);

  useEffect(() => {
    let cancelled = false;
    if (voucher.documentDataUrl) return;
    if (!voucher.documentPath || !voucher.documentMimeType?.startsWith("image/")) {
      return;
    }
    void app.resolveDocumentUrl(voucher).then((url) => {
      if (!cancelled) setRemoteThumb(url);
    });
    return () => {
      cancelled = true;
    };
  }, [app, voucher]);

  return (
    <Link
      href={`/vouchers/${voucher.id}`}
      className="card-surface block px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover bg-white"
            />
          ) : null}
          <div className="min-w-0">
            <h3 className="font-display text-lg text-forest">{voucher.merchantName}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <TypeBadge type={voucher.documentType} />
              <StatusBadge status={voucher.status} />
              <ExpiryBadge
                expiryDate={voucher.expiryDate}
                confidence={voucher.expiryConfidence}
              />
            </div>
          </div>
        </div>
        <div className="text-left">
          <p className="font-display text-xl text-forest">
            {formatIls(
              isReceipt
                ? voucher.originalAmountAgorot
                : voucher.remainingAmountAgorot,
            )}
          </p>
          <p className="text-xs text-eggplant">
            {isReceipt ? "סכום קבלה" : "יתרה לפי הדיווח שלך"}
          </p>
        </div>
      </div>
    </Link>
  );
}
