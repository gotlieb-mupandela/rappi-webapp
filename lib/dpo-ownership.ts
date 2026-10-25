/**
 * Fail closed. A payment is owned only when both ids are non-empty strings
 * and they are equal. undefined === undefined is not a match.
 */
export function ownsPayment(ownerId: unknown, userId: unknown) {
  return (
    typeof ownerId === "string" &&
    typeof userId === "string" &&
    ownerId.length > 0 &&
    userId.length > 0 &&
    ownerId === userId
  );
}

/** Payment status may run only for a signed-in user with a non-empty id. */
export function paymentStatusUserId(user: { id?: unknown } | null | undefined) {
  if (!user || typeof user.id !== "string" || user.id.length === 0) return null;
  return user.id;
}
