"use client";

import { useState } from "react";
import { InvoiceLightbox } from "./invoice-lightbox";

type Props = {
  url: string | null;
  mimeType: string | null;
  fileName: string | null;
  merchantName: string;
  /** Larger hero preview for the detail page */
  hero?: boolean;
};

export function DocumentPreview({
  url,
  mimeType,
  fileName,
  merchantName,
  hero = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const isImage = Boolean(mimeType?.startsWith("image/"));
  const isPdf = mimeType === "application/pdf";
  const isHeic =
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    /\.heic$/i.test(fileName ?? "") ||
    /\.heif$/i.test(fileName ?? "");

  if (url && isImage && !isHeic) {
    return (
      <>
        <button
          type="button"
          className="group relative block w-full overflow-hidden rounded-2xl bg-white text-right"
          onClick={() => setOpen(true)}
          aria-label={`הצג תעודת זיכוי — ${merchantName}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`תעודת זיכוי — ${merchantName}`}
            className={`w-full object-contain ${hero ? "max-h-[70dvh]" : "max-h-96"}`}
          />
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-forest/90 px-4 py-2 text-center text-sm font-extrabold text-[var(--cream-ink)] shadow-sm transition group-hover:bg-forest">
            הצג תעודת זיכוי במסך מלא
          </span>
        </button>
        <InvoiceLightbox
          open={open}
          url={url}
          title={`תעודת זיכוי · ${merchantName}`}
          onClose={() => setOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="rounded-2xl bg-[rgba(163,193,226,0.2)] px-4 py-3 text-center text-sm text-eggplant">
      {fileName ? (
        <p>
          הקובץ <span className="font-semibold text-night">{fileName}</span>{" "}
          שמור
          {isPdf ? " (PDF)" : ""}
          {isHeic ? " (HEIC — אין תצוגה מקדימה בדפדפן)" : ""}.
        </p>
      ) : (
        <p>אין תמונת מסמך עדיין — הוסיפו זיכוי עם צילום.</p>
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
