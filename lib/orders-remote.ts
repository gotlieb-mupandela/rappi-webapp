import type { Order } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  created_at: string;
  email: string;
  full_name: string;
  phone: string | null;
  address: string;
  city: string;
  country: string;
  shipping_method: string;
  shipping_cost: number;
  subtotal: number;
  total: number;
  status: Order["status"];
  order_items: Array<{
    code: string;
    name: string;
    size: string;
    qty: number;
    unit_price: number;
  }> | null;
};

function mapRow(row: OrderRow): Order {
  return {
    id: row.id,
    createdAt: row.created_at,
    email: row.email,
    name: row.full_name,
    phone: row.phone ?? undefined,
    address: row.address,
    city: row.city,
    country: row.country,
    shippingMethod: row.shipping_method,
    shippingCost: Number(row.shipping_cost),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    status: row.status,
    remote: true,
    items: (row.order_items ?? []).map((item) => ({
      code: item.code,
      name: item.name,
      size: item.size,
      qty: item.qty,
      price: Number(item.unit_price),
    })),
  };
}

/** Load orders for the current Supabase session (by user_id). */
export async function fetchRemoteOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, email, full_name, phone, address, city, country, shipping_method, shipping_cost, subtotal, total, status, order_items(code, name, size, qty, unit_price)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return (data as OrderRow[]).map(mapRow);
  } catch {
    return [];
  }
}

export function mergeOrders(local: Order[], remote: Order[]): Order[] {
  const remoteIds = new Set(remote.map((order) => order.id));
  const byId = new Map<string, Order>();
  for (const order of [...remote, ...local]) {
    if (!byId.has(order.id)) byId.set(order.id, order);
  }
  return [...byId.values()]
    .map((order) => (remoteIds.has(order.id) ? { ...order, remote: true } : order))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
