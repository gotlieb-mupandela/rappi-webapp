export const ORDER_STATUSES = ["reserved", "preparing", "shipped", "cancelled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_CLASS: Record<OrderStatus, string> = {
  reserved: "bg-[rgba(232,163,23,0.16)] text-[var(--warn)]",
  preparing: "bg-[rgba(61,184,255,0.16)] text-[#3db8ff]",
  shipped: "bg-[var(--ok-muted)] text-[var(--ok)]",
  cancelled: "bg-[rgba(226,59,74,0.16)] text-[var(--danger)]",
};

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

export function orderStatusClass(status: string) {
  return isOrderStatus(status) ? STATUS_CLASS[status] : "bg-[var(--hover)] text-[var(--muted)]";
}
