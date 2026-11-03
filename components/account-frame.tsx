"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { useT } from "@/components/locale-provider";
import { accountRoleKey, displayName } from "@/lib/auth/session";
import { useAuth } from "@/lib/stores/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "account", href: "/account", label: "account.title" },
  { id: "orders", href: "/account/orders", label: "account.orders" },
] as const;

export type AccountSection = (typeof NAV)[number]["id"];

function AccountActions() {
  const logout = useAuth((s) => s.logout);
  const router = useRouter();
  const t = useT();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void logout().then(() => router.push("/"));
        }}
        className="flex min-h-11 w-full flex-col items-start justify-center py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70"
      >
        <span className="text-sm text-neutral-600">{t("account.logout")}</span>
        <span className="text-xs leading-4 text-neutral-400">{t("account.logoutHint")}</span>
      </button>
      <Link
        href="/account/delete"
        className="flex min-h-11 w-full items-center text-sm leading-5 text-[var(--danger)] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70"
      >
        {t("account.deleteAccount")}
      </Link>
    </>
  );
}

export function AccountFrame({
  section,
  crumbs,
  children,
}: {
  section: AccountSection;
  crumbs: Crumb[];
  children: ReactNode;
}) {
  const user = useAuth((s) => s.user);
  const t = useT();

  if (!user) return null;

  const name = displayName(user);
  const role = t(accountRoleKey(user.role));

  return (
    <div className="page-shell py-8 sm:py-10">
      <Breadcrumbs items={crumbs} />
      <div className="mt-6 flex w-full min-w-0 flex-col gap-8 lg:mt-8 lg:grid lg:grid-cols-[minmax(15.5rem,18rem)_minmax(0,1fr)] lg:items-start lg:gap-x-14 lg:gap-y-0 xl:gap-x-20">
        <aside className="min-w-0">
          <h1 className="break-words font-[family-name:var(--font-oswald)] text-[1.75rem] font-medium leading-[1.15] text-black">
            {name}
          </h1>
          <dl className="mt-4 space-y-3">
            <div className="min-w-0">
              <dt className="text-xs text-neutral-500">{t("account.email")}</dt>
              <dd className="mt-1 break-all text-sm leading-5 text-black">{user.email}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-neutral-500">{t("account.role")}</dt>
              <dd className="mt-1 flex min-w-0 items-center gap-2 text-sm leading-5 text-black">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                <span className="min-w-0 break-words">{role}</span>
              </dd>
            </div>
          </dl>
          <nav aria-label={t("account.myAccount")} className="mt-6 border-t border-black/10 pt-2">
            <ul>
              {NAV.map((item) => {
                const current = item.id === section;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center border-l-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/70",
                        current
                          ? "border-[var(--accent)] bg-[var(--accent-muted)] font-semibold text-black"
                          : "border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-black",
                      )}
                    >
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-6 hidden border-t border-black/10 pt-3 lg:block">
            <AccountActions />
          </div>
        </aside>

        <div className="min-w-0">{children}</div>

        <div className="border-t border-black/10 pt-3 lg:hidden">
          <AccountActions />
        </div>
      </div>
    </div>
  );
}
