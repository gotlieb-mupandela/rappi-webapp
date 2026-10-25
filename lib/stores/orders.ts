"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order } from "@/lib/types";
import { fetchRemoteOrders, mergeOrders } from "@/lib/orders-remote";

type OrdersState = {
  orders: Order[];
  add: (order: Order) => void;
  mergeRemote: (remote: Order[]) => void;
  syncRemote: () => Promise<void>;
};

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      add: (order) =>
        set((s) => ({
          orders: s.orders.some((o) => o.id === order.id)
            ? s.orders
            : [order, ...s.orders],
        })),
      mergeRemote: (remote) =>
        set((s) => ({ orders: mergeOrders(s.orders, remote) })),
      syncRemote: async () => {
        const remote = await fetchRemoteOrders();
        if (remote.length) get().mergeRemote(remote);
      },
    }),
    { name: "rappi-orders", skipHydration: true },
  ),
);
