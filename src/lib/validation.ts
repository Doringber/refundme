import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "./constants";

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "";
}

export function resolveUploadMime(file: File): string {
  return file.type || guessMimeFromName(file.name);
}

export function validateUpload(file: File): string | null {
  const mime = resolveUploadMime(file);
  if (
    !mime ||
    !ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number])
  ) {
    return "סוג הקובץ אינו נתמך. העלו תמונה (JPEG/PNG/WebP) או PDF.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "הקובץ גדול מדי. הגודל המרבי הוא 10MB.";
  }
  if (file.size === 0) {
    return "הקובץ ריק.";
  }
  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("קריאת הקובץ נכשלה"));
    reader.readAsDataURL(file);
  });
}
