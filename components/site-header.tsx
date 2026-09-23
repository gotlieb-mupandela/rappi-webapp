"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useT } from "@/components/locale-provider";
import { AUDIENCES, CATEGORIES } from "@/lib/catalog";
import { hubName } from "@/lib/i18n/labels";
import { jomaAudienceLinks, jomaOutletLinks } from "@/lib/joma-nav";
import { useAuth } from "@/lib/stores/auth";
import { cartCount, useCart } from "@/lib/stores/cart";
import { CategorySubNav } from "@/components/category-sub-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StorefrontTaxonomy } from "@/lib/listing-types";
import { cn } from "@/lib/utils";

type NavKey =
  | "men"
  | "women"
  | "kids"
  | "shoes"
  | "teamwear"
  | "accessories"
  | "outlet";

type UnderLink = { href: string; label: string };

/** Exact Joma B2B ACCESSORIES dropdown labels → RAPPI shop routes. */
const JOMA_ACCESSORIES_LINKS: UnderLink[] = [
  { label: "Balls", href: "/shop/balls-bags?sub=balls" },
  { label: "Goalkeeper gloves", href: "/shop/football?sub=gk-gloves" },
  { label: "Backpacks", href: "/shop/balls-bags?sub=bags" },
  { label: "Socks", href: "/shop/balls-bags?sub=socks" },
  { label: "Socks", href: "/shop/balls-bags?sub=socks" },
  { label: "Teamwear accessories", href: "/teamwear" },
  { label: "Running accessories", href: "/shop/running-fitness?sub=accessories" },
  { label: "Racket Accessories", href: "/shop/balls-bags?sub=rackets" },
  { label: "Padel rackets", href: "/shop/padel?sub=rackets" },
  { label: "Pickleball paddles", href: "/shop/balls-bags?sub=rackets" },
  { label: "Outdoor accessories", href: "/shop/hiking" },
  { label: "Fitness / Gym Accessories", href: "/shop/running-fitness" },
  { label: "Accessories stores", href: "/store" },
  { label: "Teamwear Catalogue", href: "/shop/teampro-2026" },
];

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
  const [hoveredNav, setHoveredNav] = useState<NavKey | null>(null);
  const [ready, setReady] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useT();
  const lines = useCart((s) => s.lines);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const count = cartCount(lines);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
    setAccountOpen(false);
    setHoveredNav(null);
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
      if (!searchRef.current?.contains(target)) setSearchOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setOpen(false);
        setSearchOpen(false);
        setHoveredNav(null);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  function openUnderNav(key: NavKey) {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    setHoveredNav(key);
    setSearchOpen(false);
    setAccountOpen(false);
  }

  function scheduleCloseUnderNav() {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = setTimeout(() => setHoveredNav(null), 120);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    setOpen(false);
    setSearchOpen(false);
  }

  const visibleCategories = CATEGORIES.filter((c) => (categoryCounts[c.slug] ?? 0) > 0);
  const activeSlug = CATEGORIES.find(
    (c) => pathname === `/category/${c.slug}` || pathname.startsWith(`/shop/${c.slug}`),
  )?.slug;
  const activeAudience = AUDIENCES.find((a) => pathname.startsWith(`/shop/${a.slug}`))?.slug;

  const catalogNav: Array<{
    key: NavKey;
    href: string;
    label: string;
    active: boolean;
  }> = [
    { key: "men", href: "/shop/men", label: t("nav.man"), active: activeAudience === "men" },
    { key: "women", href: "/shop/women", label: t("nav.woman"), active: activeAudience === "women" },
    { key: "kids", href: "/shop/kids", label: t("nav.children"), active: activeAudience === "kids" },
    {
      key: "shoes",
      href: "/shop/shoes",
      label: t("nav.footwear"),
      active: activeSlug === "shoes",
    },
    {
      key: "teamwear",
      href: "/teamwear",
      label: t("nav.officialKits"),
      active: pathname.startsWith("/teamwear") || activeSlug === "teampro-2026",
    },
    {
      key: "accessories",
      href: "/shop/balls-bags",
      label: t("nav.accessories"),
      active: activeSlug === "balls-bags",
    },
    {
      key: "outlet",
      href: "/promotions",
      label: t("nav.outlet"),
      active: pathname === "/promotions",
    },
  ];

  const underLinksByKey: Record<NavKey, UnderLink[]> = {
    men: jomaAudienceLinks("men"),
    women: jomaAudienceLinks("women"),
    kids: [
      { label: "1-4 years", href: "/shop/kids?age=1-4" },
      { label: "6-10 years", href: "/shop/kids?age=6-10" },
      { label: "12-14 year old boy", href: "/shop/kids?age=12-14&gender=boy" },
      { label: "12-14 year old girl", href: "/shop/kids?age=12-14&gender=girl" },
    ],
    shoes: [
      { label: "Man", href: "/shop/shoes?audience=men" },
      { label: "Woman", href: "/shop/shoes?audience=women" },
      { label: "Junior", href: "/shop/shoes?audience=kids" },
      { label: "Outlet", href: "/promotions" },
    ],
    teamwear: [
      { label: "Sponsor replicas", href: "/shop/teampro-2026" },
      { label: "Committees and Federations", href: "/teamwear?view=quote" },
      { label: "Special Editions", href: "/promotions?view=all" },
    ],
    accessories: JOMA_ACCESSORIES_LINKS,
    /** Exact Joma B2B OUTLET dropdown labels → RAPPI shop / promotions routes. */
    outlet: jomaOutletLinks(),
  };

  const iconBtn =
    "flex h-10 w-10 items-center justify-center text-[var(--text)] transition-colors hover:bg-[var(--accent-muted)]";

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
          "border-b border-black/10 bg-white pt-[env(safe-area-inset-top)] text-neutral-900",
          open ? "fixed inset-x-0 top-0 z-[100]" : "sticky top-0 z-50",
        )}
      >
        <div className="relative z-20 flex h-16 items-center px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
          <button
            type="button"
            className={cn(iconBtn, "lg:hidden")}
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

          <Link
            href="/"
            className="relative z-10 flex shrink-0 items-center"
            aria-label={t("nav.homeAria")}
            onMouseEnter={() => setHoveredNav(null)}
          >
            <BrandLogo
              className="h-8 w-auto max-w-[8.5rem] sm:h-9 sm:max-w-[10rem]"
              priority
            />
          </Link>

          <nav
            className="pointer-events-none absolute inset-x-0 hidden justify-center lg:flex"
            onMouseLeave={scheduleCloseUnderNav}
          >
            <ul className="pointer-events-auto flex items-center gap-x-1 xl:gap-x-2">
              {catalogNav.map((item) => {
                const menuOpen = hoveredNav === item.key;
                const links = underLinksByKey[item.key];
                return (
                  <li
                    key={item.key}
                    className="relative"
                    onMouseEnter={() => openUnderNav(item.key)}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        "block whitespace-nowrap px-2.5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--text)] transition-colors hover:bg-[var(--accent-muted)] xl:px-3",
                        (item.active || menuOpen) && "bg-[var(--accent-muted)]",
                      )}
                      aria-expanded={menuOpen}
                      aria-haspopup={links.length > 0 ? "true" : undefined}
                    >
                      {item.label}
                    </Link>
                    {menuOpen && links.length > 0 ? (
                      <div
                        role="menu"
                        className="absolute left-0 top-full z-[60] max-h-[min(70vh,28rem)] min-w-[15rem] overflow-y-auto border border-[var(--border)] bg-white py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
                        onMouseEnter={() => openUnderNav(item.key)}
                      >
                        {links.map((link, i) => (
                          <Link
                            key={`${item.key}-${i}-${link.href}-${link.label}`}
                            href={link.href}
                            role="menuitem"
                            className="block px-4 py-2.5 text-[13px] leading-snug text-[var(--text)] transition-colors hover:bg-[var(--accent-muted)]"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="relative z-10 ml-auto flex items-center" onMouseEnter={() => setHoveredNav(null)}>
            <div className="relative" ref={searchRef}>
              <button
                type="button"
                className={iconBtn}
                aria-label={searchOpen ? t("nav.closeSearch") : t("nav.search")}
                aria-expanded={searchOpen}
                onClick={() => {
                  setOpen(false);
                  setAccountOpen(false);
                  setHoveredNav(null);
                  setSearchOpen((v) => !v);
                }}
              >
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </button>
              {searchOpen ? (
                <form
                  onSubmit={onSearch}
                  className="absolute right-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] border border-black/10 bg-white p-3 shadow-sm"
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={t("nav.searchPlaceholder")}
                      className="h-10 border-black/15 bg-white pl-10 text-neutral-900"
                      aria-label={t("nav.searchAria")}
                      autoFocus
                    />
                  </div>
                </form>
              ) : null}
            </div>
            <Link
              href="/cart"
              className="relative flex h-10 items-center gap-1.5 px-1.5 text-neutral-900 transition-colors hover:text-neutral-500"
              aria-label={t("nav.cart")}
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="price min-w-4 text-[11px] font-medium tabular-nums">
                {ready ? String(count).padStart(2, "0") : "00"}
              </span>
            </Link>
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className={iconBtn}
                aria-label={t("nav.account")}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setSearchOpen(false);
                  setHoveredNav(null);
                  setAccountOpen((v) => !v);
                }}
              >
                <User className="h-5 w-5" />
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-2 min-w-48 overflow-hidden border border-black/10 bg-white py-1 text-neutral-900 shadow-sm"
                >
                  {ready && user ? (
                    <>
                      <Link
                        href="/account"
                        role="menuitem"
                        className="block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-neutral-50"
                      >
                        {t("nav.account")}
                      </Link>
                      <Link
                        href="/account/orders"
                        role="menuitem"
                        className="block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-neutral-50"
                      >
                        {t("nav.orders")}
                      </Link>
                      <Link
                        href="/account/profile"
                        role="menuitem"
                        className="block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-neutral-50"
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
                        className="block w-full px-3 py-2.5 text-left text-xs uppercase tracking-wider hover:bg-neutral-50"
                      >
                        {t("nav.logout")}
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      role="menuitem"
                      className="block px-3 py-2.5 text-xs uppercase tracking-wider hover:bg-neutral-50"
                    >
                      {t("nav.signIn")}
                    </Link>
                  )}
                  <div className="border-t border-black/8 px-3 py-3">
                    <LocaleSwitcher className="w-full justify-center border-black/15 text-neutral-900" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

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
              className="fixed inset-x-0 bottom-0 z-[90] flex flex-col bg-white text-neutral-900 top-[calc(var(--header-h)+env(safe-area-inset-top))] lg:hidden"
            >
              <ScrollArea className="min-h-0 flex-1 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <form onSubmit={onSearch} className="mb-5">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("nav.searchPlaceholderLong")}
                    className="h-11 border-black/15 bg-white text-neutral-900"
                  />
                </form>
                <ul className="grid gap-1">
                  {catalogNav.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex min-h-11 items-center px-2 text-xs font-semibold uppercase tracking-wider text-neutral-900 hover:bg-neutral-50",
                          item.active && "text-black",
                        )}
                      >
                        {item.label}
                      </Link>
                      <ul className="mb-2 ml-3 grid gap-0.5 border-l border-black/10 pl-3">
                        {underLinksByKey[item.key].slice(0, 8).map((link, i) => (
                          <li key={`${item.key}-${i}-${link.href}-${link.label}`}>
                            <Link
                              href={link.href}
                              className="flex min-h-9 items-center text-[11px] uppercase tracking-wider text-neutral-600 hover:text-black"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <ul className="mt-4 grid grid-cols-2 gap-1 border-t border-black/8 pt-4">
                  {visibleCategories.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/category/${c.slug}`}
                        className={cn(
                          "flex min-h-11 items-center px-2 text-xs font-semibold uppercase tracking-wider text-neutral-900 hover:bg-neutral-50",
                          activeSlug === c.slug && "text-black",
                        )}
                      >
                        {hubName(c.slug, t)}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 grid gap-2">
                  <Button asChild className="w-full" variant="outline">
                    <Link href="/teamwear?view=quote">{t("home.teamwearCta")}</Link>
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
                  <div className="pt-2">
                    <LocaleSwitcher className="border-black/15 text-neutral-900" />
                  </div>
                </div>
              </ScrollArea>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
