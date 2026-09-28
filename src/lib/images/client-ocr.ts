"use client";

/**
 * Browser OCR for Israeli voucher photos.
 * Runs in the user's browser (CDN lang data) so phone photos work
 * even when the server has no AI Gateway / OCR credentials.
 */
export async function clientOcrImage(file: Blob): Promise<string | null> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("heb");
    try {
      const result = await worker.recognize(file);
      const text = result.data.text?.trim();
      return text && text.length > 8 ? text : null;
    } finally {
      await worker.terminate();
    }
  } catch {
    return null;
  }
}
