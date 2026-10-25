"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/stores/cart";

export function ClearCartOnPaid({ paid }: { paid: boolean }) {
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    if (paid) clear();
  }, [paid, clear]);

  return null;
}
