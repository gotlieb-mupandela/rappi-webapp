"use client";

import { useEffect, useRef } from "react";
import { trackMeta, type MetaContentItem } from "@/lib/meta/pixel";

export function MetaPurchase({
  paid,
  eventId,
  value,
  contents,
}: {
  paid: boolean;
  eventId: string | null;
  value: number;
  contents: MetaContentItem[];
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (!paid || !eventId || sent.current) return;
    sent.current = true;
    trackMeta(
      "Purchase",
      {
        currency: "NAD",
        value,
        content_type: "product",
        content_ids: contents.map((item) => item.id),
        contents,
        num_items: contents.reduce((n, item) => n + (item.quantity ?? 1), 0),
      },
      eventId,
    );
  }, [contents, eventId, paid, value]);

  return null;
}
