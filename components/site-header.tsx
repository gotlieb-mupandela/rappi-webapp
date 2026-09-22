"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Search, ShoppingBag, User, X, ChevronDown } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useT } from "@/components/locale-provider";
import { AUDIENCES, CATEGORIES, NAV_PRIMARY } from "@/lib/catalog";
import { audienceName, hubName, hubNav } from "@/lib/i18n/labels";
import { useAuth } from "@/lib/stores/auth";
import { cartCount, useCart } from "@/lib/stores/cart";
import { CategorySubNav } from "@/components/category-sub-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StorefrontTaxonomy } from "@/lib/listing-types";
import { cn } from "@/lib/utils";

export function SiteHeader({
  taxonomy,
  categoryCounts,
}: {
  taxonomy: StorefrontTaxonomy;
  categoryCounts: Record<string, number>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLLIElement>(null);
  const t = useT();
  const lines = useCart((s) => s.lines);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const count = cartCount(lines);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
    setAccountOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;
    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };
  }, [open]);

  useEffect(() => {
    function onPointer(e: Event) {
      const target = e.target as Node;
      if (!accountRef.current?.contains(target)) setAccountOpen(false);
      if (!moreRef.current?.contains(target)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setMoreOpen(false);
        setOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    setOpen(false);
    setSearchOpen(false);
  }

  const visibleCategories = CATEGORIES.filter((c) => (categoryCounts[c.slug] ?? 0) > 0);
  const primaryNav = NAV_PRIMARY.map((slug) => visibleCategories.find((c) => c.slug === slug)).filter(
    (c): c is (typeof CATEGORIES)[number] => Boolean(c),
  );
  const moreNav = visibleCategories.filter(
    (c) => !NAV_PRIMARY.includes(c.slug as (typeof NAV_PRIMARY)[number]),
  );

  const activeSlug = CATEGORIES.find(
    (c) => pathname === `/category/${c.slug}` || pathname.startsWith(`/shop/${c.slug}`),
  )?.slug;
  const activeAudience = AUDIENCES.find((a) => pathname.startsWith(`/shop/${a.slug}`))?.slug;

  return (
    <>
    {open ? (
      <div
        className="lg:hidden"
        style={{ height: "calc(var(--header-h) + env(safe-area-inset-top))" }}
        aria-hidden
      />
    ) : null}
    <header
      className={cn(
        "border-b pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow,border-color] duration-300",
        // backdrop-filter creates a containing block that clips fixed descendants —
        // keep blur only when the mobile drawer is closed.
        open
          ? "fixed inset-x-0 top-0 z-[100] border-[var(--border)] bg-[var(--chrome)]"
          : cn(
              "sticky top-0 z-50 backdrop-blur-xl backdrop-saturate-150",
              scrolled
                ? "border-[var(--border)] bg-[var(--header-bg-scrolled)] shadow-[var(--shadow-soft)]"
                : "border-[var(--border)] bg-[var(--header-bg)]",
            ),
      )}
    >
      <div className="page-shell flex h-16 min-w-0 items-center gap-1 sm:h-[5.5rem] sm:gap-4">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-[var(--hover)] lg:hidden"
          aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => {
            setSearchOpen(false);
            setOpen((v) => !v);
          }}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" className="flex min-w-0 shrink items-center" aria-label={t("nav.homeAria")}>
          <BrandLogo
            className="h-12 w-auto max-w-[9.5rem] sm:h-[4.75rem] sm:max-w-[14rem]"
            priority
          />
        </Link>

        <form onSubmit={onSearch} className="mx-3 hidden w-full max-w-[18rem] flex-1 md:flex lg:max-w-[20rem]">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-2)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("nav.searchPlaceholder")}
              className="h-10 pl-10"
              aria-label={t("nav.searchAria")}
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <LocaleSwitcher className="mr-0.5 hidden md:flex" />
          <ThemeToggle className="hidden md:flex" />
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-[var(--hover)] hover:text-[var(--accent)] md:hidden"
            aria-label={searchOpen ? t("nav.closeSearch") : t("nav.search")}
            aria-expanded={searchOpen}
            onClick={() => {
              setOpen(false);
              setSearchOpen((v) => !v);
            }}
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          <Link
            href="/cart"
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-[var(--hover)] hover:text-[var(--accent)]"
            aria-label={t("nav.cart")}
          >
            <ShoppingBag className="h-5 w-5" />
            {ready && count > 0 ? (
              <span className="price absolute right-1 top-1 min-w-4 rounded-full bg-[var(--accent)] px-1 text-center text-[10px] font-bold leading-4 text-[var(--on-accent)]">
                {count}
              </span>
            ) : null}
          </Link>
          {ready && user ? (
            <div className="relative hidden md:block" ref={accountRef}>
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-full px-2 text-ink transition-colors hover:bg-[var(--hover)] hover:text-[var(--accent)]"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => setAccountOpen((v) => !v)}
              >
                <User className="h-5 w-5" />
                <span className="hidden text-[11px] font-semibold uppercase tracking-wider sm:inline">
                  {user.name}
                </span>
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 min-w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-soft)]"
                >
                  <Link
                    href="/account"
                    role="menuitem"
                    className="block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-[var(--hover)] hover:text-[var(--accent)]"
                  >
                    {t("nav.account")}
                  </Link>
                  <Link
                    href="/account/orders"
                    role="menuitem"
                    className="block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-[var(--hover)] hover:text-[var(--accent)]"
                  >
                    {t("nav.orders")}
                  </Link>
                  <Link
                    href="/account/profile"
                    role="menuitem"
                    className="block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-[var(--hover)] hover:text-[var(--accent)]"
                  >
                    {t("nav.profile")}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void logout();
                      setAccountOpen(false);
                      router.push("/");
                    }}
                    className="block w-full px-3 py-2.5 text-left text-xs uppercase tracking-wider hover:bg-[var(--hover)] hover:text-[var(--accent)]"
                  >
                    {t("nav.logout")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden h-11 items-center gap-2 rounded-full px-2 text-ink transition-colors hover:bg-[var(--hover)] hover:text-[var(--accent)] md:flex"
            >
              <User className="h-5 w-5" />
              <span className="hidden text-[11px] font-semibold uppercase tracking-wider sm:inline">
                {t("nav.account")}
              </span>
            </Link>
          )}
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-[var(--border)] bg-[var(--chrome)] px-4 py-3 md:hidden">
          <form onSubmit={onSearch}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-2)]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("nav.searchPlaceholderLong")}
                className="h-11 pl-10"
                aria-label={t("nav.searchAria")}
                autoFocus
              />
            </div>
            <Button type="submit" className="mt-3 w-full">
              {t("nav.search")}
            </Button>
          </form>
        </div>
      ) : null}

      <nav className="hidden border-t border-[var(--border)] lg:block">
        <ul className="page-shell flex flex-wrap items-center justify-center gap-x-5 gap-y-1 py-2.5 xl:gap-x-7">
          {AUDIENCES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/shop/${a.slug}`}
                data-active={activeAudience === a.slug || undefined}
                className="nav-link text-[11px] font-semibold uppercase tracking-[0.14em]"
              >
                {audienceName(a.slug, t)}
              </Link>
            </li>
          ))}
          {primaryNav.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                data-active={activeSlug === c.slug || undefined}
                className="nav-link text-[11px] font-semibold uppercase tracking-[0.14em]"
              >
                {hubNav(c.slug, t)}
              </Link>
            </li>
          ))}
          {moreNav.length > 0 ? (
          <li className="relative" ref={moreRef}>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              data-active={moreNav.some((c) => c.slug === activeSlug) || undefined}
              className="nav-link cursor-pointer border-0 bg-transparent text-[11px] font-semibold uppercase tracking-[0.14em]"
              onClick={() => setMoreOpen((v) => !v)}
            >
              {t("nav.more")}
              <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen ? (
              <div
                role="menu"
                className="absolute left-1/2 top-full z-20 mt-2 min-w-44 -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-soft)]"
              >
                {moreNav.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    role="menuitem"
                    className={cn(
                      "block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-[var(--hover)] hover:text-[var(--accent)]",
                      activeSlug === c.slug && "text-[var(--accent)]",
                    )}
                  >
                    {hubName(c.slug, t)}
                  </Link>
                ))}
              </div>
            ) : null}
          </li>
          ) : null}
          <li>
            <Link
              href="/promotions"
              data-active={pathname === "/promotions" || undefined}
              className="nav-link text-[11px] font-semibold uppercase tracking-[0.14em] !text-[var(--accent)]"
            >
              {t("nav.newCollections")}
            </Link>
          </li>
        </ul>
      </nav>
      {!open ? (
        <Suspense fallback={null}>
          <CategorySubNav taxonomy={taxonomy} />
        </Suspense>
      ) : null}

    </header>
    {ready && open
      ? createPortal(
          <div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.openMenu")}
            className="fixed inset-x-0 bottom-0 z-[90] flex flex-col bg-[var(--chrome)] top-[calc(var(--header-h)+env(safe-area-inset-top))] lg:hidden"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <form onSubmit={onSearch} className="mb-5">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("nav.searchPlaceholderLong")}
                  className="h-11"
                />
              </form>
              <div className="mb-5 flex items-center justify-between gap-3">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
              <ul className="mb-3 grid grid-cols-3 gap-1">
                {AUDIENCES.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/shop/${a.slug}`}
                      className={cn(
                        "flex min-h-11 items-center justify-center rounded-lg bg-[var(--hover)] px-2 text-xs font-semibold uppercase tracking-wider text-ink hover:text-[var(--accent)]",
                        activeAudience === a.slug && "text-[var(--accent)]",
                      )}
                    >
                      {audienceName(a.slug, t)}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="grid grid-cols-2 gap-1">
                {visibleCategories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/category/${c.slug}`}
                      className={cn(
                        "flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold uppercase tracking-wider text-ink hover:bg-[var(--hover)] hover:text-[var(--accent)]",
                        activeSlug === c.slug && "text-[var(--accent)]",
                      )}
                    >
                      {hubName(c.slug, t)}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid gap-2">
                <Button asChild className="w-full" variant="outline">
                  <Link href="/promotions">{t("nav.newCollections")}</Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/teamwear">{t("home.teamwearCta")}</Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/store">{t("footer.findStore")}</Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href={user ? "/account" : "/login"}>
                    {user ? t("nav.myAccount") : t("nav.signIn")}
                  </Link>
                </Button>
                {user ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      void logout().then(() => {
                        setOpen(false);
                        router.push("/");
                      });
                    }}
                  >
                    {t("nav.logout")}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
