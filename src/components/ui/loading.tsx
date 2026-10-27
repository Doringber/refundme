export function LoadingBlock({ label = "טוען…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="skeleton h-28 w-28 rounded-full" />
      <div className="skeleton h-4 w-40" />
      <p className="text-sm font-bold text-eggplant">{label}</p>
    </div>
  );
}
