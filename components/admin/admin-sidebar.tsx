"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShoppingBag,
  Truck,
  Users,
  ClipboardList,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/quotes", label: "Quotes", icon: ClipboardList },
  { href: "/admin/content", label: "Content", icon: Settings2 },
  { href: "/admin/shipping", label: "Shipping", icon: Truck },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-2 py-3">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
              active
                ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="mt-auto border-t border-[var(--border)] p-3">
      <div className="mb-2 flex items-center justify-between rounded-lg px-1">
        <span className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Appearance</span>
        <ThemeToggle className="h-9 w-9" />
      </div>
      <Link
        href="/"
        className="mb-2 block rounded-lg px-3 py-2 text-xs uppercase tracking-wider text-[var(--muted)] hover:text-ink"
      >
        View storefront
      </Link>
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-ink"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--footer-bg)] px-3 py-2 lg:hidden">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-[var(--hover)]"
          aria-label={open ? "Close admin menu" : "Open admin menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <BrandLogo variant="mark" className="h-9 w-9" />
        <p className="font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide">
          RAPPI Admin
        </p>
      </header>

      {open ? (
        <button
          type="button"
          aria-label="Close admin menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--footer-bg)] transition-transform duration-200 lg:static lg:z-auto lg:h-dvh lg:w-60 lg:max-w-none lg:translate-x-0 lg:sticky lg:top-0 lg:overflow-y-auto",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="hidden items-center gap-2 border-b border-[var(--border)] px-4 py-3 lg:flex">
          <BrandLogo variant="mark" className="h-10 w-10" />
          <div>
            <p className="font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide text-ink">
              RAPPI Admin
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              Back office
            </p>
          </div>
        </div>
        <NavLinks onNavigate={() => setOpen(false)} />
        <SidebarFooter onLogout={logout} />
      </aside>
    </>
  );
}
