import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string compare. Missing values never match. */
export function secretsMatch(
  expected: string | undefined,
  got: string | null | undefined,
): boolean {
  if (!expected || got == null || got === "") return false;
  const a = createHash("sha256").update(expected, "utf8").digest();
  const b = createHash("sha256").update(got, "utf8").digest();
  return timingSafeEqual(a, b);
}
