/** A missing user id never owns a payment. Callers that omit the customer must opt in. */
export function customerOwnsPayment(ownerId: string | null, userId: string | null | undefined) {
  return Boolean(userId && ownerId === userId);
}
