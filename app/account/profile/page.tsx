"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { accountRoleKey, displayName } from "@/lib/auth/session";
import { useAuth } from "@/lib/stores/auth";
import { useT } from "@/components/locale-provider";

export default function ProfilePage() {
  const user = useAuth((s) => s.user);
  const t = useT();

  if (!user) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-oswald)] text-4xl uppercase">{t("account.profile")}</h1>
        <Button asChild className="mt-6">
          <Link href="/login">{t("nav.signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] px-4 py-8 lg:px-6">
      <Breadcrumbs
        items={[
          { href: "/", label: t("common.home") },
          { href: "/account", label: t("account.myAccount") },
          { label: t("account.profile") },
        ]}
      />
      <h1 className="mt-6 font-[family-name:var(--font-oswald)] text-4xl uppercase">
        {t("account.profile")}
      </h1>
      <dl className="mt-8 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid gap-1 border-b border-[var(--border)] px-4 py-3 text-sm sm:grid-cols-[140px_1fr] sm:gap-0">
          <dt className="uppercase tracking-wider text-[var(--muted)]">{t("account.name")}</dt>
          <dd className="break-words">{displayName(user)}</dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--border)] px-4 py-3 text-sm sm:grid-cols-[140px_1fr] sm:gap-0">
          <dt className="uppercase tracking-wider text-[var(--muted)]">{t("account.email")}</dt>
          <dd className="break-all">{user.email}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[140px_1fr] sm:gap-0">
          <dt className="uppercase tracking-wider text-[var(--muted)]">{t("account.role")}</dt>
          <dd>{t(accountRoleKey(user.role))}</dd>
        </div>
      </dl>
    </div>
  );
}
