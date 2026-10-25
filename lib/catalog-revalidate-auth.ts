import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret compare. Different lengths never throw:
 * timingSafeEqual runs on two equal-length buffers, then the length check fails the match.
 */
export function secretsMatch(provided: string, expected: string) {
  if (!expected) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes =
    provided.length === expected.length ? Buffer.from(provided) : expectedBytes;
  const equal =
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
  return provided.length === expected.length && equal;
}
