/**
 * Server-side OCR is intentionally a no-op in production serverless.
 * Phone photos are OCR'd in the browser (see client-ocr.ts); the text is
 * posted to /api/extract as `ocrText` and parsed with Israeli voucher heuristics.
 * Netlify AI Gateway vision may also run on the image.
 */

export async function ocrImageToText(): Promise<string | null> {
  return null;
}
