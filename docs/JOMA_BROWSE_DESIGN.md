# Joma Browse Design Reference

Source of truth for folder drill-down and product listing chrome, matching the Joma B2B portal screenshots and [`Joma_B2B_Category_Tree.pdf`](./Joma_B2B_Category_Tree.pdf).

**Chrome scope:** Keep Rappi header/logo. Replicate **page body** only (back, crumbs, title, sibling strip, folder grid, listing).

**Screenshots:** [`references/joma-men-folders.png`](./references/joma-men-folders.png), [`references/joma-teamwear-folders.png`](./references/joma-teamwear-folders.png), [`references/joma-outerwear-folders.png`](./references/joma-outerwear-folders.png), [`references/joma-softshell-listing.png`](./references/joma-softshell-listing.png).

---

## Flow

```
Men → Teamwear → Outerwear → Soft Shell / Polar → products
```

| Level | Example URL | UI |
|-------|-------------|-----|
| Audience mid folders | `/shop/men` | ~7-col tiles, label under image |
| Mid children | `/shop/men?group=teamwear` | Same tiles + sibling underline subnav |
| Leaf folders | `/shop/men?group=outerwear` | Fewer tiles left-aligned + siblings |
| Products | `/shop/men?group=soft-shell-polar` | Title `[n]`, collection tabs, ruled sections, hover matrix |

Women uses audience-scoped apparel roots where Part B differs (`teamwear-woman`, `running-trail-woman`, `racket-sports-woman`, `fitness-gym-woman`, `lifestyle-apparel-woman`, `underwear-brama-woman`; `/shop/women?group=…`). Footwear uses `/shop/shoes` / `/category/shoes` with `FOOTWEAR_FOLDERS`. Accessories (`accessories` → `acc-*`) and Outlet (`outlet` → `outlet-*`) are real folder trees; Kids age bands are parents with full Part B subtrees.

---

## Folder tile chrome

- Portrait studio plate on light gray (`#eceff1`), **edge-to-edge cover** (no padded contain)
- **White label bar under** the image — centered, bold uppercase, near-black (`#1a1a2e`); no piece counts
- Near-flush gutters (`2px`); grid **7 columns from `lg`**, browse shell up to **1920px**
- Hover: **1px navy outline** around the whole tile (image + label); subtle image zoom
- Empty folders still render

Homepage bento tiles stay overlay-style (`variant` default). Catalog folder hubs use `variant="folder"` via `FolderGrid`.

---

## Sibling subnav

- Text links, uppercase, navy **underline** on active
- Depth:
  - `/shop/men` (no group) → apparel mid folders (Teamwear, Running, …)
  - `?group=teamwear` → Teamwear children
  - `?group=outerwear` → Outerwear leaves (Anorak, Raincoats, Soft Shell)
  - Leaf product view → still show parent’s children with leaf active

---

## Product listing

- Title: `Soft Shell/Polar [23]` style (`PageHeader` + count)
- Grid / list toggle (icons)
- Collection / type tabs: underline active; prefer **item-family collection** grouping when ≥2 groups
- Section headers: bold uppercase on a full-width navy hairline + `[n]`
- Card: light gray plate → cart icon top-right → **SKU → name → Tariff {price}**
- Hover matrix (desktop): columns = sizes; rows = Size labels / Price / **Available stock** (green). No invented incoming-stock dates.

---

## PDF → code keys (`lib/joma-tree.ts`)

| PDF / screenshot | Key |
|------------------|-----|
| Teamwear | `teamwear` |
| Teamwear Pro 2026 | `teamwear-pro-2026` → sport leaves (`tp-*`) |
| Running / Trail | `running-trail` → New SS27 / In stock / Previous / Teamwear collections |
| Cycling | `cycling` → SS27 / FW26 / Previous season |
| Racket sports | `racket-sports` → New SS27 / In stock / Previous / Teamwear collections |
| Hiking / Outdoor | `hiking-outdoor` → SS27 / In stock / Previous |
| Fitness / Gym | `fitness-gym` → New / In stock / Previous |
| Lifestyle | `lifestyle-apparel` → SS27 / In stock / Previous / Básicos |
| Underwear / Brama | `underwear-brama` → Brama Line / Sujetadores / Intimi |
| Training Polyester / Cotton | `training-polyester`, `training-cotton` (+ collection children) |
| Outerwear | `outerwear` |
| Anorak/Jackets | `anorak-jackets` |
| Raincoats/Windbreakers | `raincoats-windbreakers` |
| Soft Shell/Polar | `soft-shell-polar` |
| Football / Futsal (apparel) | `tw-football` |
| Running / Trail | `running-trail` |
| Footwear → Football surfaces | `football-surfaces` → `football-fg` / `ag` / `sg` |

i18n: `sub.{key}` and/or `group.apparel.{key}` in `lib/i18n/messages.ts`.

---

## Image placement

| Asset | Use on |
|-------|--------|
| `/brand/hub-teampro-2026.png` | Teamwear, Teamwear Pro 2026 |
| `/brand/hub-shoes.png` | Footwear hub, Running, Trail |
| `/brand/hub-lifestyle.png` | Football footwear (cleats) |
| `/brand/hub-rugby.png` | Rugby apparel |
| `/brand/hub-sportswear.png` | Sportswear hub |
| `/brand/hub-kids.png` | Kids bands |
| `/brand/audience-men.png` / `audience-women.png` | Audience entry tiles |
| Product sample | Soft Shell / Outerwear leaves when no plate |

**Needed later:** dedicated Soft Shell, Anorak, Raincoat, Cycling, Racket, Hiking model plates.

---

## Gaps

- Official Kits / Accessories / Outlet as top-level hubs — not shipped
- Many deep PDF collection leaves still thin or empty
- Incoming stock date rows — no catalog field yet
- Folder covers mostly product samples, not full Joma model photography
