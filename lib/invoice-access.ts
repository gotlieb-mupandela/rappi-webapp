import { ownsPayment } from "@/lib/dpo-ownership";

/** Admin, or the order's user. Missing ids do not match each other. */
export function canReadInvoice(isAdmin: boolean, orderUserId: unknown, callerUserId: unknown) {
  return Boolean(isAdmin) || ownsPayment(orderUserId, callerUserId);
}
