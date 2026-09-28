"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  url: string;
  title: string;
  onClose: () => void;
};

/** Full-screen, simple viewer for a refund invoice / credit slip photo */
export function InvoiceLightbox({ open, url, title, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[rgba(20,28,24,0.94)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-[var(--cream-ink)]">
        <p className="truncate font-display text-lg">{title}</p>
        <button
          type="button"
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-extrabold"
          onClick={onClose}
        >
          סגור
        </button>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-auto px-3 pb-8"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          className="max-h-[min(92dvh,920px)] w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <p className="pb-4 text-center text-xs text-white/70">
        הציגו את המסמך בקופה · תמונה אינה מבטיחה קבלה בכל סניף
      </p>
    </div>
  );
}
