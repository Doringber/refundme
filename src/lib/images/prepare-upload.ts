"use client";

/**
 * Prepare an uploaded document for preview + storage:
 * - Raster images are resized/compressed to JPEG to avoid localStorage quota
 *   failures and oversized Supabase uploads.
 * - HEIC/HEIF often cannot render in <img>; we attempt canvas decode and
 *   fall back with a clear error if the browser cannot.
 * - PDFs pass through unchanged.
 */

import { resolveUploadMime } from "@/lib/validation";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export type PreparedUpload = {
  file: File;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  convertedFromHeic: boolean;
};

function isRasterImage(mime: string): boolean {
  return mime.startsWith("image/") && mime !== "image/svg+xml";
}

function isHeic(mime: string, name: string): boolean {
  return (
    mime === "image/heic" ||
    mime === "image/heif" ||
    /\.heic$/i.test(name) ||
    /\.heif$/i.test(name)
  );
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("לא ניתן להציג את התמונה בדפדפן זה"));
    img.src = src;
  });
}

async function compressToJpeg(
  file: File,
  sourceDataUrl: string,
): Promise<{ blob: Blob; dataUrl: string }> {
  const img = await loadImageElement(sourceDataUrl);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("דחיסת התמונה נכשלה");
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("דחיסת התמונה נכשלה"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  return { blob, dataUrl };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("קריאת הקובץ נכשלה"));
    reader.readAsDataURL(file);
  });
}

export async function prepareUploadFile(file: File): Promise<PreparedUpload> {
  const mime = resolveUploadMime(file);

  if (mime === "application/pdf") {
    const dataUrl = await readAsDataUrl(file);
    return {
      file,
      dataUrl,
      mimeType: "application/pdf",
      fileName: file.name,
      convertedFromHeic: false,
    };
  }

  if (!isRasterImage(mime) && !isHeic(mime, file.name)) {
    const dataUrl = await readAsDataUrl(file);
    return {
      file,
      dataUrl,
      mimeType: mime || "application/octet-stream",
      fileName: file.name,
      convertedFromHeic: false,
    };
  }

  const heic = isHeic(mime, file.name);
  const sourceDataUrl = await readAsDataUrl(file);

  try {
    const { blob, dataUrl } = await compressToJpeg(file, sourceDataUrl);
    const baseName = file.name.replace(/\.(heic|heif|jpe?g|png|webp)$/i, "");
    const fileName = `${baseName || "document"}.jpg`;
    const next = new File([blob], fileName, { type: "image/jpeg" });
    return {
      file: next,
      dataUrl,
      mimeType: "image/jpeg",
      fileName,
      convertedFromHeic: heic,
    };
  } catch {
    if (heic) {
      throw new Error(
        "תמונות HEIC מהאייפון לא נתמכות לתצוגה כאן. שמרו כ־JPEG/PNG ב״תמונות״ והעלו שוב.",
      );
    }
    // Keep original if compression fails (e.g. odd WebP)
    return {
      file,
      dataUrl: sourceDataUrl,
      mimeType: mime,
      fileName: file.name,
      convertedFromHeic: false,
    };
  }
}
