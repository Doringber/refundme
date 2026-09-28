"use client";

import { enterDemoMode } from "@/lib/app-data/context";

export function DemoEntryButton({
  className,
  children = "כניסה למצב דמו",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={() => enterDemoMode()}>
      {children}
    </button>
  );
}
