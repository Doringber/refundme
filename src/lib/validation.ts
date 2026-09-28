import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "./constants";

export function validateUpload(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
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
