export type MetaStandardEvent =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

export type MetaContentItem = {
  id: string;
  quantity?: number;
  item_price?: number;
};

export type MetaEventParams = {
  content_ids?: string[];
  contents?: MetaContentItem[];
  content_type?: "product" | "product_group";
  content_name?: string;
  content_category?: string;
  currency?: "NAD";
  value?: number;
  num_items?: number;
  search_string?: string;
};

declare global {
  interface Window {
    fbq?: (
      action: "track" | "trackCustom" | "init",
      event: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void;
  }
}

export function newMetaEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rappi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function trackMeta(
  event: MetaStandardEvent,
  params?: MetaEventParams,
  eventId?: string,
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return eventId;
  const id = eventId ?? newMetaEventId();
  window.fbq("track", event, params ?? {}, { eventID: id });
  return id;
}
