"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/stores/auth";
import { useOrders } from "@/lib/stores/orders";
import { useT } from "@/components/locale-provider";

export default function AccountPage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const orders = useOrders((s) => s.orders);
  const syncRemote = useOrders((s) => s.syncRemote);
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    void syncRemote();
  }, [syncRemote]);

  if (!user) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-oswald)] text-4xl uppercase">{t("account.title")}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {t("account.signInHint")}
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">{t("nav.signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-shell py-8">
      <Breadcrumbs items={[{ href: "/", label: t("common.home") }, { label: t("account.myAccount") }]} />
      <h1 className="mt-6 font-[family-name:var(--font-oswald)] text-4xl uppercase">
        {t("account.myAccount")}
      </h1>
      <p className="mt-2 min-w-0 break-all text-sm text-[var(--muted)]">{t("account.signedInAs", { email: user.email })}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link href="/account/orders" className="surface-card p-6">
          <p className="text-xs uppercase tracking-wider text-[var(--accent)]">{t("account.orders")}</p>
          <p className="mt-2 text-2xl font-semibold">{orders.length}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("account.ordersHint")}</p>
        </Link>
        <Link href="/account/profile" className="surface-card p-6">
          <p className="text-xs uppercase tracking-wider text-[var(--accent)]">{t("account.profile")}</p>
          <p className="mt-2 text-2xl font-semibold">{user.name}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("account.profileHint")}</p>
        </Link>
        <button
          type="button"
          onClick={() => {
            void logout().then(() => router.push("/"));
          }}
          className="surface-card p-6 text-left"
        >
          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{t("account.session")}</p>
          <p className="mt-2 text-2xl font-semibold">{t("account.logout")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("account.logoutHint")}</p>
        </button>
      </div>
    </div>
  );
}
