"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { feedVariantId } from "@/lib/meta/ids";
import { trackMeta } from "@/lib/meta/pixel";
import type { CartLine, CartLineSnapshot, Product } from "@/lib/types";
import { sizeDisplayLabel, sizeStock, skuStock } from "@/lib/product-stock";

type CartMessage = {
  ok: boolean;
  messageKey: string;
  values?: Record<string, string | number>;
};

type CartState = {
  lines: CartLine[];
  add: (product: Product, size: string, qty: number) => CartMessage;
  setQty: (code: string, size: string, qty: number) => void;
  remove: (code: string, size: string) => void;
  clear: () => void;
};

function snapshotFromProduct(product: Product, size: string): CartLineSnapshot {
  return {
    id: product.id,
    name: product.name,
    displayName: product.displayName,
    title: product.title,
    item: product.item,
    price: product.price,
    unitPrice: product.unitPrice,
    imageUrl: product.imageUrl,
    sizeStock: sizeStock(product, size),
    stockQty: skuStock(product),
    category: product.category,
    subcategory: product.subcategory,
    gender: product.gender,
    badge: product.badge,
  };
}

function remainingSku(lines: CartLine[], code: string, stockQty: number, ignoreSize?: string) {
  const used = lines
    .filter((l) => l.code === code && l.size !== ignoreSize)
    .reduce((n, l) => n + l.qty, 0);
  return Math.max(0, stockQty - used);
}

function isCompleteLine(line: Partial<CartLine>): line is CartLine {
  return Boolean(
    line.code &&
      line.size &&
      typeof line.qty === "number" &&
      line.id &&
      typeof line.price === "number" &&
      typeof line.sizeStock === "number" &&
      typeof line.stockQty === "number",
  );
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (product, size, qty): CartMessage => {
        const available = sizeStock(product, size);
        if (available <= 0) {
          return { ok: false, messageKey: "cart.sizeNotInStock" };
        }
        const snap = snapshotFromProduct(product, size);
        const existing = get().lines.find((l) => l.code === product.code && l.size === size);
        const nextQty = (existing?.qty ?? 0) + qty;
        const left =
          remainingSku(get().lines, product.code, snap.stockQty, size) + (existing?.qty ?? 0);
        const max = Math.min(available, left, snap.stockQty);
        if (nextQty > max) {
          return {
            ok: false,
            messageKey: max <= 0 ? "cart.soldOut" : "cart.onlyInStock",
            values: { max },
          };
        }
        const line: CartLine = {
          code: product.code,
          size,
          qty: nextQty,
          ...snap,
        };
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.code === product.code && l.size === size ? { ...l, ...line } : l,
            ),
          });
        } else {
          set({ lines: [...get().lines, { ...line, qty }] });
        }
        const label = sizeDisplayLabel(size);
        const variantId = feedVariantId(product.code, size);
        const unit = product.unitPrice || product.price;
        trackMeta("AddToCart", {
          content_ids: [variantId],
          contents: [{ id: variantId, quantity: qty, item_price: unit }],
          content_type: "product",
          content_name: product.displayName || product.name,
          content_category: product.category,
          currency: "NAD",
          value: unit * qty,
          num_items: qty,
        });
        return {
          ok: true,
          messageKey: "cart.added",
          values: { name: product.displayName || product.code, label },
        };
      },
      setQty: (code, size, qty) => {
        const existing = get().lines.find((l) => l.code === code && l.size === size);
        if (!existing || existing.sizeStock <= 0) {
          set({
            lines: get().lines.filter((l) => !(l.code === code && l.size === size)),
          });
          return;
        }
        const left = remainingSku(get().lines, code, existing.stockQty, size);
        const max = Math.min(existing.sizeStock, left, existing.stockQty);
        const clamped = Math.max(0, Math.min(qty, max));
        if (clamped === 0) {
          set({
            lines: get().lines.filter((l) => !(l.code === code && l.size === size)),
          });
          return;
        }
        set({
          lines: get().lines.map((l) =>
            l.code === code && l.size === size ? { ...l, qty: clamped } : l,
          ),
        });
      },
      remove: (code, size) =>
        set({
          lines: get().lines.filter((l) => !(l.code === code && l.size === size)),
        }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "rappi-cart",
      version: 2,
      skipHydration: true,
      migrate: (persisted) => {
        const state = persisted as { lines?: Partial<CartLine>[] } | undefined;
        const lines = (state?.lines ?? []).filter(isCompleteLine);
        return { lines };
      },
    },
  ),
);

export function cartCount(lines: CartLine[]) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** Build a Product-shaped stub for image/alt helpers from a cart line snapshot. */
export function cartLineAsProduct(line: CartLine): Product {
  return {
    id: line.id,
    code: line.code,
    item: line.item || line.name,
    title: line.title || line.name,
    name: line.name,
    displayName: line.displayName || line.name,
    category: line.category,
    subcategory: line.subcategory,
    gender: line.gender,
    price: line.price,
    unitPrice: line.unitPrice,
    currency: "NAD",
    sheetCategory: null,
    totalQty: line.stockQty,
    stockQty: line.stockQty,
    badge: line.badge,
    sizeOptions: [line.size],
    sizes: [{ size: line.size, stock: line.sizeStock }],
    imageUrl: line.imageUrl,
    images: line.imageUrl ? [line.imageUrl] : [],
  };
}
