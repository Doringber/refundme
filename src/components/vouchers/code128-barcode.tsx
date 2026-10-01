"use client";

import { useMemo } from "react";
import { barcodePayload, code128Svg } from "@/lib/barcode/code128";

export function Code128Barcode({
  barcodeValue,
  voucherCode,
  className,
}: {
  barcodeValue: string | null;
  voucherCode: string | null;
  className?: string;
}) {
  const svg = useMemo(() => {
    const payload = barcodePayload({ barcodeValue, voucherCode });
    if (!payload) return null;
    return code128Svg(payload, { height: 96, moduleWidth: 2.2, quiet: 12 });
  }, [barcodeValue, voucherCode]);

  if (!svg) return null;

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-hidden={false}
    />
  );
}
