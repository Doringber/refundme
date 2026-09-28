/**
 * Small SVG data-URLs used as demo “photos” of vouchers.
 * Kept tiny so localStorage seed stays under quota.
 */

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function voucherSvg(opts: {
  brand: string;
  title: string;
  amount: string;
  code?: string;
  accent: string;
}): string {
  const codeLine = opts.code
    ? `<text x="40" y="210" fill="#5c6b5e" font-size="14" font-family="Arial,sans-serif">קוד: ${opts.code}</text>`
    : "";
  return svgDataUrl(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7faf4"/>
      <stop offset="100%" stop-color="#e4efe0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" rx="28" fill="url(#bg)"/>
  <rect x="24" y="24" width="592" height="352" rx="22" fill="#fff" stroke="${opts.accent}" stroke-width="3"/>
  <rect x="24" y="24" width="592" height="72" rx="22" fill="${opts.accent}"/>
  <rect x="24" y="60" width="592" height="36" fill="${opts.accent}"/>
  <text x="48" y="70" fill="#f8fbf6" font-size="28" font-family="Arial,sans-serif" font-weight="700">${opts.brand}</text>
  <text x="40" y="140" fill="#2f4f3a" font-size="22" font-family="Arial,sans-serif" font-weight="700">${opts.title}</text>
  <text x="40" y="185" fill="#355e4e" font-size="48" font-family="Georgia,serif">${opts.amount}</text>
  ${codeLine}
  <text x="40" y="330" fill="#7a8a7c" font-size="13" font-family="Arial,sans-serif">תצוגת דמו — במצב אמיתי תוצג התמונה שהעליתם</text>
</svg>`);
}

export const DEMO_DOCUMENT_PREVIEWS = {
  fox: voucherSvg({
    brand: "FOX",
    title: "זיכוי החזרה",
    amount: "₪280",
    code: "FOX-88421",
    accent: "#355e4e",
  }),
  zara: voucherSvg({
    brand: "ZARA",
    title: "שובר מתנה",
    amount: "₪200",
    code: "ZR-GIFT-552",
    accent: "#4a6741",
  }),
  superpharm: voucherSvg({
    brand: "סופר-פארם",
    title: "שובר קנייה",
    amount: "₪80",
    accent: "#2f6f67",
  }),
  ikea: voucherSvg({
    brand: "IKEA",
    title: "קבלה / תיעוד",
    amount: "₪459",
    accent: "#c5a35a",
  }),
} as const;
