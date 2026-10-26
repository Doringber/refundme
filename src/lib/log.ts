/** Server log line. Never pass tokens, cookies, or request bodies. */
export function logServerError(scope: string, error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown";
  console.error(`[${scope}] ${message}`);
}
