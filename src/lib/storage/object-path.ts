const ID_RE = /^[\w-]{1,80}$/;

/** Drop path segments so a file name cannot escape the user's folder. */
export function safeDocumentFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "document";
  const cleaned = base
    .replace(/[^A-Za-z0-9._\-\u0590-\u05FF ]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180);
  return cleaned || "document";
}

export function voucherDocumentObjectPath(
  userId: string,
  voucherId: string,
  fileName: string,
): string {
  if (!ID_RE.test(userId) || !ID_RE.test(voucherId)) {
    throw new Error("INVALID_STORAGE_ID");
  }
  return `${userId}/${voucherId}/${safeDocumentFileName(fileName)}`;
}

export function isOwnedDocumentPath(userId: string, documentPath: string): boolean {
  if (!ID_RE.test(userId)) return false;
  if (documentPath.includes("\\") || documentPath.includes("..")) return false;
  const parts = documentPath.split("/");
  if (parts.length < 2 || parts.some((part) => part.length === 0 || part === ".")) {
    return false;
  }
  return parts[0] === userId;
}
