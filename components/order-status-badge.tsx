import { orderStatusClass } from "@/lib/order-status";

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${orderStatusClass(status)}`}
    >
      {status}
    </span>
  );
}
