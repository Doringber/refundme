export function LoadingBlock({ label = "טוען…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[rgba(53,94,78,0.2)] border-t-[var(--forest)] motion-reduce:animate-none" />
      <p className="text-sm text-eggplant">{label}</p>
    </div>
  );
}
