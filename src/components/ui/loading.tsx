export function LoadingBlock({ label = "טוען…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[rgba(71,181,168,0.25)] border-t-[var(--pool)] motion-reduce:animate-none" />
      <p className="text-sm text-eggplant">{label}</p>
    </div>
  );
}
