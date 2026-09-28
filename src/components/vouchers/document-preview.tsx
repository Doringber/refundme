"use client";

type Props = {
  url: string | null;
  mimeType: string | null;
  fileName: string | null;
  merchantName: string;
};

export function DocumentPreview({
  url,
  mimeType,
  fileName,
  merchantName,
}: Props) {
  const isImage = Boolean(mimeType?.startsWith("image/"));
  const isPdf = mimeType === "application/pdf";
  const isHeic =
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    /\.heic$/i.test(fileName ?? "") ||
    /\.heif$/i.test(fileName ?? "");

  if (url && isImage && !isHeic) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`מסמך מקורי — ${merchantName}`}
        className="max-h-96 w-full rounded-2xl object-contain bg-white"
      />
    );
  }

  return (
    <div className="rounded-2xl bg-[rgba(163,193,226,0.2)] px-4 py-8 text-center text-sm text-eggplant">
      {fileName ? (
        <p>
          הקובץ <span className="font-semibold text-night">{fileName}</span>{" "}
          שמור
          {isPdf ? " (PDF)" : ""}
          {isHeic ? " (HEIC — אין תצוגה מקדימה בדפדפן)" : ""}.
        </p>
      ) : (
        <p>אין תצוגה מקדימה למסמך זה.</p>
      )}
      <p className="mt-2 text-xs">
        תמונה אינה מבטיחה שכל קופה תקבל את הצילום במקום המקור.
      </p>
      {url && (isPdf || isHeic) && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-bold text-forest"
        >
          {isPdf ? "פתיחת PDF" : "הורדת הקובץ"}
        </a>
      )}
    </div>
  );
}
