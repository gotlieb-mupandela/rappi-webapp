"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { AccountFrame } from "@/components/account-frame";
import { PushToggle } from "@/components/push-toggle";
import { useT } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/stores/auth";
import { useOrders } from "@/lib/stores/orders";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const user = useAuth((s) => s.user);
  const orders = useOrders((s) => s.orders);
  const syncRemote = useOrders((s) => s.syncRemote);
  const t = useT();

  useEffect(() => {
    void syncRemote();
  }, [syncRemote]);

  if (!user) {
    return (
      <div className="page-shell py-10 sm:py-14">
        <div className="mx-auto w-full min-w-0 max-w-lg">
          <h1 className="text-2xl font-medium leading-tight text-black">{t("account.title")}</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">{t("account.signInHint")}</p>
          <Button asChild className="mt-6">
            <Link href="/login">{t("nav.signIn")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const orderCount = orders.length;

  return (
    <AccountFrame
      section="account"
      crumbs={[{ href: "/", label: t("common.home") }, { label: t("account.myAccount") }]}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <Link
          href="/account/orders"
          className="group relative flex min-h-11 w-full min-w-0 items-center gap-4 overflow-hidden border border-black/10 bg-white px-4 py-4 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70 sm:px-5 sm:py-5"
        >
          <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-black">{t("account.orders")}</span>
            {orderCount === 0 ? (
              <span className="mt-0.5 block text-sm leading-5 text-neutral-500">{t("account.noOrders")}</span>
            ) : null}
            <span className="mt-0.5 block text-sm leading-5 text-neutral-500">{t("account.ordersHint")}</span>
          </span>
          <span
            className={cn(
              "shrink-0 font-[family-name:var(--font-oswald)] text-3xl font-medium leading-none tabular-nums sm:text-4xl",
              orderCount === 0 ? "text-neutral-400" : "text-black",
            )}
          >
            {orderCount}
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-black"
            aria-hidden
          />
        </Link>

        <div className="border-y border-black/10">
          <PushToggle />
        </div>
      </div>
    </AccountFrame>
  );
}
