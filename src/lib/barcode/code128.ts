/**
 * Minimal Code 128 (subset B + auto C for digit pairs) → SVG path widths.
 * No external dependency — good enough for checkout scanners.
 */

/** Pattern widths for codes 0–106 (6 digits = bar/space/bar/space/bar/space) */
const PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;

function isDigitPair(s: string, i: number): boolean {
  return (
    i + 1 < s.length &&
    s.charCodeAt(i) >= 48 &&
    s.charCodeAt(i) <= 57 &&
    s.charCodeAt(i + 1) >= 48 &&
    s.charCodeAt(i + 1) <= 57
  );
}

function encodeValues(text: string): number[] {
  // Prefer Code C when the whole string is even-length digits
  const allDigits = /^\d+$/.test(text);
  if (allDigits && text.length >= 2 && text.length % 2 === 0) {
    const values = [START_C];
    for (let i = 0; i < text.length; i += 2) {
      values.push(Number(text.slice(i, i + 2)));
    }
    return values;
  }

  const values: number[] = [START_B];
  let i = 0;
  let inC = false;

  while (i < text.length) {
    if (!inC && isDigitPair(text, i) && isDigitPair(text, i + 2)) {
      values.push(CODE_C);
      inC = true;
    }
    if (inC && isDigitPair(text, i)) {
      values.push(Number(text.slice(i, i + 2)));
      i += 2;
      if (!isDigitPair(text, i)) {
        values.push(CODE_B);
        inC = false;
      }
      continue;
    }
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) {
      // Skip non-ASCII (Hebrew etc.) — present screen still shows the text
      i += 1;
      continue;
    }
    values.push(code - 32);
    i += 1;
  }

  if (values.length === 1) {
    // Empty after filtering — encode a placeholder space
    values.push(0);
  }
  return values;
}

/** Returns module widths array for drawing bars (alternating black/white). */
export function encodeCode128Widths(text: string): number[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const values = encodeValues(cleaned);
  let checksum = values[0];
  for (let i = 1; i < values.length; i += 1) {
    checksum += values[i] * i;
  }
  checksum %= 103;
  const all = [...values, checksum, STOP];

  const widths: number[] = [];
  for (const v of all) {
    const pattern = PATTERNS[v];
    if (!pattern) continue;
    for (const ch of pattern) {
      widths.push(Number(ch));
    }
  }
  return widths;
}

export function code128Svg(
  text: string,
  opts: { height?: number; moduleWidth?: number; quiet?: number } = {},
): string | null {
  const widths = encodeCode128Widths(text);
  if (!widths.length) return null;

  const unit = opts.moduleWidth ?? 2;
  const height = opts.height ?? 80;
  const quiet = opts.quiet ?? 10;
  const contentWidth = widths.reduce((a, b) => a + b, 0) * unit;
  const width = contentWidth + quiet * 2 * unit;

  let x = quiet * unit;
  const rects: string[] = [];
  let black = true;
  for (const w of widths) {
    const rw = w * unit;
    if (black) {
      rects.push(
        `<rect x="${x}" y="0" width="${rw}" height="${height}" fill="#000"/>`,
      );
    }
    x += rw;
    black = !black;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="ברקוד">${rects.join("")}</svg>`;
}

export function barcodePayload(voucher: {
  barcodeValue: string | null;
  voucherCode: string | null;
}): string | null {
  const raw = (voucher.barcodeValue ?? voucher.voucherCode ?? "").trim();
  if (!raw) return null;
  // Prefer ASCII-encodable payload for Code128
  const ascii = raw.replace(/[^\x20-\x7E]/g, "");
  return ascii || null;
}
