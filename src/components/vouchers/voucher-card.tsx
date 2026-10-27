"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatIls } from "@/lib/calculations";
import { useAppData } from "@/lib/app-data/context";
import type { Voucher } from "@/lib/types";
import { ExpiryBadge, StatusBadge, TypeBadge } from "@/components/ui/status-badge";
import { InvoiceLightbox } from "./invoice-lightbox";

export function VoucherCard({ voucher }: { voucher: Voucher }) {
  const app = useAppData();
  const isReceipt = voucher.documentType === "receipt";
  const [remoteThumb, setRemoteThumb] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
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
    <article className="ticket-card overflow-hidden">
      <div className="flex gap-0">
        {thumb ? (
          <button
            type="button"
            className="relative w-[34%] max-w-[140px] shrink-0 bg-[rgba(232,240,228,0.65)]"
            onClick={() => setLightbox(true)}
            aria-label={`הצג תעודת זיכוי של ${voucher.merchantName}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt=""
              className="h-full min-h-[132px] w-full object-cover object-top"
            />
            <span className="absolute inset-x-1 bottom-1 rounded-full bg-forest/90 px-2 py-1 text-center text-[10px] font-extrabold text-[var(--cream-ink)]">
              הצג מסמך
            </span>
          </button>
        ) : null}

        <Link
          href={`/vouchers/${voucher.id}`}
          className="flex min-w-0 flex-1 flex-col justify-between gap-3 px-4 py-4 transition hover:bg-white/40"
        >
          <div>
            <h3 className="font-display text-lg text-forest">
              {voucher.merchantName}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <TypeBadge type={voucher.documentType} />
              <StatusBadge status={voucher.status} />
              <ExpiryBadge
                expiryDate={voucher.expiryDate}
                confidence={voucher.expiryConfidence}
              />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-xs font-bold text-eggplant">לפרטים</p>
            <p className="rounded-full bg-[var(--butter)] px-3 py-1 font-display text-lg text-[#1c1c1c]">
              {formatIls(
                isReceipt
                  ? voucher.originalAmountAgorot
                  : voucher.remainingAmountAgorot,
              )}
            </p>
          </div>
        </Link>
      </div>

      {thumb && (
        <InvoiceLightbox
          open={lightbox}
          url={thumb}
          title={`תעודת זיכוי · ${voucher.merchantName}`}
          onClose={() => setLightbox(false)}
        />
      )}
    </article>
  );
}
