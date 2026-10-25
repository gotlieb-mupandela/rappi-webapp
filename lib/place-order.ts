import type { CartLine, Order } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type PlaceInput = {
  email: string;
  name: string;
  address: string;
  city: string;
  country: string;
  shippingMethod: string;
  shippingCost: number;
  shippingLabel: string;
  notes: string;
  lines: CartLine[];
};

type PlaceFail = {
  ok: false;
  messageKey: string;
  values?: Record<string, string | number>;
  message?: string;
};
type PlaceResult = { ok: true; order: Order } | PlaceFail;

function localPlace(input: PlaceInput): PlaceResult {
  const items: Order["items"] = [];
  for (const line of input.lines) {
    if (!line.code || !line.size || line.qty <= 0) {
      return { ok: false, messageKey: "checkout.invalidLine", values: { code: line.code ?? "—" } };
    }
    if (line.sizeStock < line.qty) {
      return {
        ok: false,
        messageKey: "checkout.lineStock",
        values: { max: line.sizeStock, code: line.code, size: line.size },
      };
    }
    items.push({
      code: line.code,
      name: line.name,
      size: line.size,
      qty: line.qty,
      price: line.price,
    });
  }
  if (!items.length) return { ok: false, messageKey: "checkout.cartEmpty" };
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  return {
    ok: true,
    order: {
      id: `RSH${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString(),
      email: input.email,
      name: input.name,
      address: input.address,
      city: input.city,
      country: input.country,
      shippingMethod: input.shippingLabel,
      shippingCost: input.shippingCost,
      items,
      subtotal,
      total: subtotal + input.shippingCost,
      status: "reserved",
    },
  };
}

export async function placeOrder(input: PlaceInput): Promise<PlaceResult> {
  if (!input.lines.length) return { ok: false, messageKey: "checkout.cartEmpty" };
  if (!input.name || !input.email || !input.address || !input.city || !input.country) {
    return { ok: false, messageKey: "checkout.completeDetails" };
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { ok: false, messageKey: "checkout.signInRequired" };
      }

      const { data, error } = await supabase.rpc("place_order", {
        p_email: input.email,
        p_name: input.name,
        p_address: input.address,
        p_city: input.city,
        p_country: input.country,
        p_shipping_method: input.shippingMethod,
        p_notes: input.notes || "",
        p_lines: input.lines.map((l) => ({
          code: l.code,
          size: l.size,
          qty: l.qty,
        })),
      });
      if (error) return { ok: false, messageKey: "checkout.failed", message: error.message };
      const payload = data as {
        id: string;
        created_at: string;
        email: string;
        name: string;
        address: string;
        city: string;
        country: string;
        shipping_method: string;
        shipping_cost: number;
        subtotal: number;
        total: number;
        status: Order["status"];
        items: Order["items"];
      };
      return {
        ok: true,
        order: {
          id: payload.id,
          createdAt: payload.created_at,
          email: payload.email,
          name: payload.name,
          address: payload.address,
          city: payload.city,
          country: payload.country,
          shippingMethod: payload.shipping_method,
          shippingCost: Number(payload.shipping_cost),
          items: payload.items,
          subtotal: Number(payload.subtotal),
          total: Number(payload.total),
          status: payload.status,
        },
      };
    } catch (err) {
      return {
        ok: false,
        messageKey: "checkout.failed",
        message: err instanceof Error ? err.message : undefined,
      };
    }
  }

  return localPlace(input);
}
