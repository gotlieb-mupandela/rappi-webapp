import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret compare. Same body as POST /api/catalog/revalidate.
 * An unset secret must never match, including an empty Authorization header.
 * Hashing first keeps the compare the same length, so a short guess does not
 * return before timingSafeEqual.
 */
export function secretsMatch(provided: string, expected: string) {
  // An unset secret must never match, including an empty Authorization header.
  // Hashing first keeps the compare the same length, so a short guess does not
  // return before timingSafeEqual.
  if (!expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
