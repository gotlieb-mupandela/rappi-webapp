import { isStorefrontFootwear } from "@/lib/classify";
import type { Product } from "@/lib/types";

/** Normalized Joma `item` family (drops trailing [n] pack markers). */
export function itemFamilyOf(product: Pick<Product, "item">) {
  return String(product.item || "")
    .replace(/\s*\[\d+\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function normLabel(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type JomaFolderDef = {
  key: string;
  /** English label from the PDF (i18n via group.footwear / group.apparel). */
  label: string;
  /** Exact item families (normalized) that belong in this leaf. */
  families?: readonly string[];
  /**
   * Item families that must match the whole family string.
   * `families` also allows a prefix/suffix hit (`junior` → `junior football`),
   * which is right for sport folders and wrong for Outlet leaves.
   */
  exactFamilies?: readonly string[];
  /** Extra regex against family + display + name. */
  pattern?: RegExp;
  /**
   * When set, `pattern` applies only if the item family is in this list.
   * Exact `families` still match on their own. Outlet type leaves use this
   * so SKUs filed under the generic Outlet bucket can join a type leaf
   * without the pattern swallowing every jacket or tee in the catalog.
   */
  patternFamilies?: readonly string[];
  /** Storefront subcategory slug when classification maps here. */
  sub?: string;
  /**
   * When set, product.category must equal this hub slug
   * (e.g. Teamwear Pro football → `teampro-2026`).
   */
  category?: string;
  /**
   * Product's primary category or extra hubs must include one of these.
   * Used when a sport's SKUs live on their own hub rather than `teampro-2026`.
   */
  hubs?: readonly string[];
  /**
   * Drop footwear. Teamwear sport lists are apparel; shoe rows stay on Footwear.
   */
  apparelOnly?: boolean;
  /**
   * Generic leaves (pants, accessories) must also be this sport.
   * Collection names (Skrum, Hispa) stay family-only so shared names still list.
   */
  sport?: string;
  children?: readonly JomaFolderDef[];
  /** Local cover override for HubTile. */
  cover?: string;
};

function familyIn(fam: string, list: readonly string[] | undefined) {
  if (!list?.length) return false;
  const n = normLabel(fam);
  return list.some((f) => {
    const t = normLabel(f);
    return n === t || n.startsWith(`${t} `) || n.endsWith(` ${t}`);
  });
}

function exactFamilyIn(fam: string, list: readonly string[] | undefined) {
  if (!list?.length) return false;
  const n = normLabel(fam);
  return list.some((f) => normLabel(f) === n);
}

function productInListedHubs(product: Product, hubs: readonly string[] | undefined) {
  if (!hubs?.length) return false;
  return hubs.some((hub) => product.category === hub || product.hubs?.includes(hub));
}

/** Sport signal for generic leaves. Collection-specific families do not use this. */
function productMatchesSport(product: Product, sport: string, blob: string) {
  const inHub = (slug: string) =>
    product.category === slug || Boolean(product.hubs?.includes(slug));
  switch (sport) {
    case "rugby":
      return inHub("rugby") || /\b(rugby|skrum|myskin|scrum)\b/.test(blob);
    case "basketball":
      return inHub("basketball") || /\b(basketball|cancha)\b/.test(blob);
    case "handball":
      return /\b(handball|hispa)\b/.test(blob);
    case "volleyball":
      return /\bvolley/.test(blob);
    default:
      return false;
  }
}

function leafMatchesProduct(
  folder: JomaFolderDef,
  product: Product,
  fam: string,
  blob: string,
): boolean {
  if (folder.category && product.category !== folder.category) return false;
  // Apparel trees (teamwear, running, hiking, racket, …) are not shoe folders.
  // A boot named Toledo must stay on Footwear, not the T-shirt collection.
  if (
    isStorefrontFootwear(product) &&
    (folder.apparelOnly || folderUnderApparelRoot(folder.key))
  ) {
    return false;
  }
  if (folder.sport && !productMatchesSport(product, folder.sport, blob)) return false;
  if (folder.sub && product.subcategory === folder.sub) return true;
  if (exactFamilyIn(fam, folder.exactFamilies)) return true;
  if (familyIn(fam, folder.families)) return true;
  if (folder.pattern) {
    const gate = folder.patternFamilies;
    if ((!gate?.length || exactFamilyIn(fam, gate)) && folder.pattern.test(blob)) return true;
  }
  if (productInListedHubs(product, folder.hubs)) return true;
  // Category-only leaf (e.g. catch-all under a campaign hub).
  if (
    folder.category &&
    !folder.families?.length &&
    !folder.exactFamilies?.length &&
    !folder.pattern &&
    !folder.sub &&
    !folder.hubs?.length
  ) {
    return true;
  }
  return false;
}

export function folderMatchesProduct(folder: JomaFolderDef, product: Product): boolean {
  if (folderKeysByProductId) {
    return folderKeysByProductId.get(product.id)?.has(folder.key) ?? false;
  }
  if (folder.children?.length) {
    return folder.children.some((c) => folderMatchesProduct(c, product));
  }
  const fam = itemFamilyOf(product);
  const blob = `${fam} ${product.displayName} ${product.name} ${product.title}`.toLowerCase();
  return leafMatchesProduct(folder, product, fam, blob);
}

export function matchesJomaFolderKey(product: Product, key: string): boolean {
  if (folderKeysByProductId) {
    return folderKeysByProductId.get(product.id)?.has(key) ?? false;
  }
  const folder = JOMA_FOLDER_BY_KEY.get(key);
  if (!folder) return false;
  return folderMatchesProduct(folder, product);
}

/** Precomputed folder → products (built once from the offline catalog). */
let productsByFolderKey: Map<string, Product[]> | null = null;
/** Product id → folder keys (leaf + ancestors). */
let folderKeysByProductId: Map<string, Set<string>> | null = null;

export function productsInJomaFolder(key: string): Product[] {
  return productsByFolderKey?.get(key) ?? [];
}

export function hasJomaFolderIndex() {
  return productsByFolderKey != null;
}

/**
 * Index every product into Joma browse folders once at catalog load.
 * Turns O(catalog × folders × regex) page work into O(1) membership checks.
 */
const SEASON_PARENTS = new Set([
  "running-trail",
  "running-trail-woman",
  "cycling",
  "racket-sports",
  "racket-sports-woman",
  "hiking-outdoor",
  "fitness-gym",
  "fitness-gym-woman",
  "lifestyle-apparel",
  "lifestyle-apparel-woman",
]);

let apparelRootKeys: Set<string> | null = null;

function apparelRoots() {
  if (!apparelRootKeys) {
    apparelRootKeys = new Set([
      ...APPAREL_FOLDERS.map((folder) => folder.key),
      ...WOMAN_APPAREL_FOLDERS.map((folder) => folder.key),
    ]);
  }
  return apparelRootKeys;
}

/** True when this folder sits in a Man/Woman apparel tree (not Footwear). */
function folderUnderApparelRoot(key: string) {
  let cur: string | undefined = key;
  while (cur) {
    if (apparelRoots().has(cur)) return true;
    cur = JOMA_FOLDER_PARENT.get(cur);
  }
  return false;
}

function directChildOf(leafKey: string, parentKey: string) {
  let cur: string | undefined = leafKey;
  let child: string | undefined;
  while (cur && cur !== parentKey) {
    child = cur;
    cur = JOMA_FOLDER_PARENT.get(cur);
  }
  return cur === parentKey ? child : undefined;
}

function familyMatchScore(folder: JomaFolderDef, fam: string) {
  let best = 0;
  const n = normLabel(fam);
  for (const raw of folder.exactFamilies ?? []) {
    const token = normLabel(raw);
    if (token && n === token) best = Math.max(best, 400 + token.length);
  }
  for (const raw of folder.families ?? []) {
    const token = normLabel(raw);
    if (!token) continue;
    if (n === token) best = Math.max(best, 300 + token.length);
    else if (n.startsWith(`${token} `) || n.endsWith(` ${token}`)) {
      best = Math.max(best, 200 + token.length);
    }
  }
  return best;
}

/**
 * Sibling collection folders share a prefix (`Winner` vs `Winner IV`).
 * Keep the exact family hit and drop the shorter tile so one line is not
 * listed twice under the same parent.
 */
function resolveMoreSpecificSiblings(leaves: JomaFolderDef[], fam: string) {
  const unique: JomaFolderDef[] = [];
  const seen = new Set<string>();
  for (const leaf of leaves) {
    if (seen.has(leaf.key)) continue;
    seen.add(leaf.key);
    unique.push(leaf);
  }
  const byParent = new Map<string, JomaFolderDef[]>();
  const loose: JomaFolderDef[] = [];
  for (const leaf of unique) {
    const parent = JOMA_FOLDER_PARENT.get(leaf.key);
    if (!parent) {
      loose.push(leaf);
      continue;
    }
    const group = byParent.get(parent);
    if (group) group.push(leaf);
    else byParent.set(parent, [leaf]);
  }
  const kept = [...loose];
  for (const group of byParent.values()) {
    if (group.length < 2) {
      kept.push(...group);
      continue;
    }
    const exact = group.filter((leaf) => familyMatchScore(leaf, fam) >= 300);
    if (!exact.length) {
      kept.push(...group);
      continue;
    }
    const best = Math.max(...exact.map((leaf) => familyMatchScore(leaf, fam)));
    kept.push(...exact.filter((leaf) => familyMatchScore(leaf, fam) === best));
  }
  return kept;
}

/**
 * Season trees list the same line under New / In stock / Previous.
 * Without a season field, keep the most specific folder (R-City Fall beats
 * R-City) and, on a tie, the earlier season so one drop is not tiled twice.
 */
function resolveSeasonLeaves(leaves: JomaFolderDef[], fam: string, blob: string) {
  const parents = new Set<string>();
  for (const leaf of leaves) {
    let cur = JOMA_FOLDER_PARENT.get(leaf.key);
    while (cur) {
      if (SEASON_PARENTS.has(cur)) parents.add(cur);
      const parent = JOMA_FOLDER_PARENT.get(cur);
      if (parent && SEASON_PARENTS.has(parent)) parents.add(cur);
      if (SEASON_PARENTS.has(cur)) break;
      cur = parent;
    }
  }
  const depth = (key: string) => {
    let n = 0;
    let cur = JOMA_FOLDER_PARENT.get(key);
    while (cur) {
      n += 1;
      cur = JOMA_FOLDER_PARENT.get(cur);
    }
    return n;
  };
  let kept = leaves;
  for (const parentKey of [...parents].sort((a, b) => depth(b) - depth(a))) {
    const parent = JOMA_FOLDER_BY_KEY.get(parentKey);
    if (!parent?.children?.length) continue;
    const involved = kept.filter((leaf) => directChildOf(leaf.key, parentKey));
    if (involved.length < 2) continue;
    const byChild = new Map<string, JomaFolderDef[]>();
    for (const leaf of involved) {
      const child = directChildOf(leaf.key, parentKey);
      if (!child) continue;
      const group = byChild.get(child);
      if (group) group.push(leaf);
      else byChild.set(child, [leaf]);
    }
    if (byChild.size < 2) continue;
    let winner = "";
    let winnerScore = -1;
    let winnerIndex = Number.POSITIVE_INFINITY;
    for (const [child, group] of byChild) {
      const score = Math.max(
        ...group.map((leaf) => {
          const familyScore = familyMatchScore(leaf, fam);
          const patternScore =
            leaf.pattern && leaf.pattern.test(blob) ? 100 + leaf.pattern.source.length : 0;
          return Math.max(familyScore, patternScore);
        }),
      );
      const index = parent.children.findIndex((childFolder) => childFolder.key === child);
      const order = index === -1 ? Number.POSITIVE_INFINITY : index;
      if (score > winnerScore || (score === winnerScore && order < winnerIndex)) {
        winner = child;
        winnerScore = score;
        winnerIndex = order;
      }
    }
    const drop = new Set(
      involved
        .filter((leaf) => directChildOf(leaf.key, parentKey) !== winner)
        .map((leaf) => leaf.key),
    );
    kept = kept.filter((leaf) => !drop.has(leaf.key));
  }
  return kept;
}

export function indexCatalogIntoJomaFolders(catalog: Product[]) {
  const byFolder = new Map<string, Product[]>();
  const byProduct = new Map<string, Set<string>>();
  const leaves = ALL_FOLDERS.filter((f) => !f.children?.length);

  const push = (key: string, product: Product) => {
    let keys = byProduct.get(product.id);
    if (keys?.has(key)) return;
    if (!keys) {
      keys = new Set();
      byProduct.set(product.id, keys);
    }
    keys.add(key);
    const list = byFolder.get(key);
    if (list) list.push(product);
    else byFolder.set(key, [product]);
  };

  for (const product of catalog) {
    const fam = itemFamilyOf(product);
    const blob = `${fam} ${product.displayName} ${product.name} ${product.title}`.toLowerCase();
    const matched: JomaFolderDef[] = [];
    for (const leaf of leaves) {
      if (leafMatchesProduct(leaf, product, fam, blob)) matched.push(leaf);
    }
    const specific = resolveMoreSpecificSiblings(matched, fam);
    for (const leaf of resolveSeasonLeaves(specific, fam, blob)) {
      let key: string | undefined = leaf.key;
      while (key) {
        push(key, product);
        key = JOMA_FOLDER_PARENT.get(key);
      }
    }
  }

  productsByFolderKey = byFolder;
  folderKeysByProductId = byProduct;
}

export function jomaFolderByKey(key: string) {
  return JOMA_FOLDER_BY_KEY.get(key);
}

export function jomaFolderHasChildren(key: string) {
  return Boolean(jomaFolderByKey(key)?.children?.length);
}

/**
 * Teamwear Pro 2026 is the same leaf list under Man and Woman on Joma
 * (“shows all the Football products”). Unisex kit belongs on both.
 */
export function jomaFolderIsSharedAudience(key: string) {
  let cur: string | undefined = key;
  while (cur) {
    if (cur === "teamwear-pro-2026") return true;
    cur = JOMA_FOLDER_PARENT.get(cur);
  }
  return false;
}

/* ─── Footwear (PDF pp. 28–30) — shared Man/Woman sport folders ─── */

const FOOTBALL_SURFACES: readonly JomaFolderDef[] = [
  {
    key: "football-fg",
    label: "Terreno semiseco and duro",
    sub: "football-fg",
    families: ["semi-dry and hard terrain", "semi-dry", "firm ground"],
    pattern: /\b(semi[- ]?dry|hard terrain|firm ground|\bfg\b)\b/,
  },
  {
    key: "football-ag",
    label: "Césped artificial",
    sub: "football-ag",
    families: ["artificial grass"],
    pattern: /\b(artificial grass|\bag\b)\b/,
  },
  {
    key: "football-sg",
    label: "Terreno blando",
    sub: "football-sg",
    families: ["soft ground"],
    pattern: /\b(soft ground|\bsg\b)\b/,
  },
];

/** Adult Footwear folders from the PDF (Man / Woman share this shape). */
export const FOOTWEAR_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "special-editions",
    label: "Special Editions",
    // Part B parent: membership resolves via children below (own matchers
    // would be ignored for parents, so none are kept here).
    children: [
      {
        key: "se-football-futsal",
        label: "Football / Futsal",
        families: ["football / futsal", "football", "futsal"],
        pattern: /\b(football|futsal)\b/,
      },
      {
        key: "se-running",
        label: "Running",
        families: ["running"],
        pattern: /\brunning\b/,
      },
      {
        key: "se-padel",
        label: "Pádel",
        families: ["padel"],
        pattern: /\b(padel|p[aá]del)\b/,
      },
    ],
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "football-surfaces",
    label: "Football",
    children: FOOTBALL_SURFACES,
    cover: "/brand/hub-lifestyle.png?v=1",
  },
  {
    key: "futsal",
    label: "Futsal",
    sub: "futsal",
    families: ["futsal", "football / futsal"],
    pattern: /\bfutsal\b/,
    cover: "/brand/hub-lifestyle.png?v=1",
  },
  {
    key: "turf",
    label: "Turf",
    sub: "turf",
    families: ["turf"],
    pattern: /\bturf\b/,
    cover: "/brand/hub-lifestyle.png?v=1",
  },
  {
    key: "running",
    label: "Running",
    sub: "running-shoes",
    families: [
      "running",
      "running man",
      "running woman",
      "junior running",
      "r-city",
      "r-city fall",
      "r-city winter",
      "r-night",
      "r-nature",
    ],
    pattern: /\b(r-city|r-night|r-nature|running man|running woman)\b/,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "trail-running",
    label: "Trail Running",
    sub: "trail-running",
    families: ["trail running", "trail man", "trail woman", "r-trail", "r-trail "],
    pattern: /\b(trail running|r-trail|trail man|trail woman)\b/,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "tennis",
    label: "Tennis",
    sub: "tennis-shoes",
    families: ["tennis", "tennis - padel"],
    pattern: /\btennis\b/,
  },
  {
    key: "padel-shoes",
    label: "Pádel",
    sub: "padel-shoes",
    families: ["padel", "padel junior", "tennis - padel"],
    pattern: /\b(padel|p[aá]del)\b/,
  },
  {
    key: "pickleball",
    label: "Pickleball",
    sub: "pickleball-shoes",
    families: ["pickleball"],
    pattern: /\bpickleball\b/,
  },
  {
    key: "handball-shoes",
    label: "Handball",
    sub: "handball-shoes",
    families: ["handball"],
    pattern: /\bhandball\b/,
  },
  {
    key: "badminton",
    label: "Badminton",
    sub: "badminton-shoes",
    families: ["badminton"],
    pattern: /\bbadminton\b/,
  },
  {
    key: "basketball-shoes",
    label: "Basketball",
    sub: "basketball-shoes",
    families: ["basketball", "basket"],
    pattern: /\bbasket(ball)?\b/,
  },
  {
    key: "outdoor-shoes",
    label: "Outdoor",
    sub: "outdoor-shoes",
    families: ["outdoor"],
    pattern: /\boutdoor\b/,
  },
  {
    key: "hockey-shoes",
    label: "Hockey",
    sub: "hockey-shoes",
    families: ["hockey"],
    pattern: /\bhockey\b/,
  },
  {
    key: "training-shoes",
    label: "Training",
    sub: "training-shoes",
    families: ["training", "gym", "sport", "sports"],
    pattern: /\b(training shoe|gym shoe)\b/,
  },
  {
    key: "volleyball-shoes",
    label: "Volleyball",
    sub: "volleyball-shoes",
    families: ["volleyball", "volley woman", "volley"],
    pattern: /\bvolley(ball)?\b/,
  },
  {
    key: "comfort",
    label: "Confort",
    sub: "comfort-shoes",
    families: ["comfort", "comfort man", "comfort woman", "confort"],
    pattern: /\b(comfort|confort)\b/,
  },
  {
    key: "joma-flow",
    label: "Joma flow",
    sub: "joma-flow",
    families: ["joma flow", "flow"],
    pattern: /\bjoma flow\b/,
  },
  {
    key: "sandals",
    label: "Sandals confort",
    sub: "sandals",
    families: ["sandal", "sandals", "comfort sandal", "junior sandal", "summer shoe"],
    pattern: /\b(sandal|summer shoe)\b/,
  },
  {
    key: "lifestyle-shoes",
    label: "Lifestyle",
    sub: "sneakers",
    families: ["lifestyle", "fashion", "junior fashion"],
    pattern: /\b(lifestyle|fashion sneaker)\b/,
  },
  {
    key: "sneakers",
    label: "Sneakers",
    sub: "sneakers",
    families: ["sneaker", "sneakers"],
    pattern: /\bsneakers?\b/,
  },
  {
    key: "barefoot",
    label: "Barefoot",
    sub: "barefoot",
    families: ["barefoot"],
    pattern: /\bbarefoot\b/,
  },
  {
    key: "summer-shoes",
    label: "Summer shoes",
    sub: "summer-shoes",
    families: ["summer shoes", "summer shoe"],
    pattern: /\bsummer shoes?\b/,
  },
  {
    key: "forloz",
    label: "Forloz",
    sub: "forloz",
    families: ["forloz"],
    pattern: /\bforloz\b/,
  },
  {
    key: "previous-seasons-shoes",
    label: "Previous seasons",
    families: ["previous seasons", "previous collections"],
    pattern: /\bprevious (seasons|collections)\b/,
  },
  {
    key: "footwear-outlet",
    label: "Outlet",
    // Same filing as Outlet → Footwear: item family "Footwear".
    // A name-wide "outlet" pattern pulled apparel into this leaf and still
    // missed the shoes actually filed here.
    exactFamilies: ["footwear"],
  },
];

/** Kids Footwear folders from the PDF. */
export const KIDS_FOOTWEAR_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "kids-football",
    label: "Football",
    families: ["junior football", "football"],
    pattern: /\b(junior football|kids.*football|football.*junior)\b/,
    cover: "/brand/hub-lifestyle.png?v=1",
  },
  {
    key: "kids-futsal",
    label: "Futsal",
    sub: "futsal",
    families: ["futsal"],
    pattern: /\bfutsal\b/,
  },
  {
    key: "kids-turf",
    label: "Turf",
    sub: "turf",
    families: ["turf"],
    pattern: /\bturf\b/,
  },
  {
    key: "kids-running",
    label: "Running",
    sub: "running-shoes",
    families: ["junior running", "running"],
    pattern: /\b(junior running|running)\b/,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "kids-trail",
    label: "Trail Running",
    sub: "trail-running",
    families: ["trail running"],
    pattern: /\btrail running\b/,
  },
  {
    key: "kids-padel",
    label: "Pádel",
    sub: "padel-shoes",
    families: ["padel junior", "padel"],
    pattern: /\b(padel|p[aá]del)\b/,
  },
  {
    key: "kids-basketball",
    label: "Basketball",
    sub: "basketball-shoes",
    families: ["basketball"],
    pattern: /\bbasket(ball)?\b/,
  },
  {
    key: "kids-urban",
    label: "Urban",
    families: ["urban", "junior fashion"],
    pattern: /\burban\b/,
  },
  {
    key: "kids-comfort",
    label: "Confort",
    sub: "comfort-shoes",
    families: ["comfort", "confort"],
    pattern: /\b(comfort|confort)\b/,
  },
  {
    key: "kids-sneakers",
    label: "Sneakers",
    sub: "sneakers",
    families: ["sneaker", "sneakers"],
    pattern: /\bsneakers?\b/,
  },
  {
    key: "kids-colegial",
    label: "Colegial",
    families: ["colegial", "schoolwear", "schoolboy"],
    pattern: /\b(colegial|schoolwear|schoolboy)\b/,
  },
  {
    key: "kids-barefoot",
    label: "Barefoot",
    sub: "barefoot",
    families: ["barefoot"],
    pattern: /\bbarefoot\b/,
  },
  {
    key: "kids-summer",
    label: "Summer Shoes",
    sub: "summer-shoes",
    families: ["summer shoes", "summer shoe", "junior sandal"],
    pattern: /\b(summer shoes?|junior sandal)\b/,
  },
  {
    key: "kids-baby",
    label: "Baby",
    families: ["baby"],
    pattern: /\bbaby\b/,
  },
  {
    key: "kids-outlet",
    label: "Outlet",
    families: ["outlet"],
    pattern: /\boutlet\b/,
  },
];

/* ─── Apparel mid folders (PDF Man / Woman) ─── */

function collectionLeaves(
  prefix: string,
  entries: readonly {
    key: string;
    label: string;
    families?: readonly string[];
    exactFamilies?: readonly string[];
    pattern?: RegExp;
    sport?: string;
  }[],
): JomaFolderDef[] {
  return entries.map((e) => ({
    key: `${prefix}-${e.key}`,
    label: e.label,
    families: e.families,
    exactFamilies: e.exactFamilies,
    pattern: e.pattern,
    sport: e.sport,
  }));
}

const POLYESTER_COLLECTIONS = collectionLeaves("poly", [
  { key: "championship-20", label: "Championship 20", families: ["championship 20", "championship 2.0"] },
  { key: "heroic", label: "Heroic", families: ["heroic"] },
  { key: "winner-iv", label: "Winner IV", families: ["winner iv"] },
  { key: "phoenix-iii", label: "Phoenix III", families: ["phoenix iii"] },
  { key: "picasho-city", label: "Picasho city", families: ["picasho city", "picasho"] },
  { key: "championship-viii", label: "Championship VIII", families: ["championship viii"] },
  { key: "lider", label: "Lider", families: ["lider", "líder"] },
  { key: "eco-retro", label: "Eco-Retro", families: ["eco-retro", "eco. retro"] },
  { key: "danubio-iv", label: "Danubio IV", families: ["danubio iv"] },
  { key: "danubio-iii", label: "Danubio III", families: ["danubio iii"] },
  { key: "championship-vii", label: "Championship VII", families: ["championship vii"] },
  { key: "toledo", label: "Toledo", families: ["toledo"] },
  { key: "victory", label: "Victory", families: ["victory"] },
  { key: "winner-iii", label: "Winner III", families: ["winner iii"] },
  { key: "lion-ii", label: "Lion II", families: ["lion ii"] },
  { key: "eco-championship", label: "Eco Championship", families: ["eco championship"] },
  { key: "crew-v", label: "Crew V", families: ["crew v"] },
  { key: "supernova-iv", label: "Supernova IV", families: ["supernova iv"] },
  { key: "campus-street", label: "Campus Street", families: ["campus street"] },
  { key: "olimpiada", label: "Olimpiada", families: ["olimpiada"] },
  { key: "academy-iv", label: "Academy IV", families: ["academy iv"] },
  { key: "hobby", label: "Hobby", families: ["hobby"] },
  { key: "combi", label: "Combi", families: ["combi"] },
  { key: "combi-premium", label: "Combi Premium", families: ["combi premium"] },
  { key: "winner", label: "Winner", families: ["winner"] },
  { key: "faraon", label: "Faraon", families: ["faraon", "faraón"] },
  { key: "cairo-ii", label: "Cairo II", families: ["cairo ii"] },
  { key: "menfis", label: "Menfis", families: ["menfis"] },
  { key: "costa-micro", label: "Costa Micro", families: ["costa micro"] },
  { key: "sena", label: "Sena", families: ["sena"] },
  { key: "gala", label: "Gala", families: ["gala"] },
  { key: "doha", label: "Doha", families: ["doha"] },
  { key: "tactica", label: "Táctica", families: ["tactica", "táctica"] },
  {
    key: "pants",
    label: "Pants",
    families: ["pants", "long pants", "pants / shorts"],
    pattern: /\bpants\b/,
  },
]);

const COTTON_COLLECTIONS = collectionLeaves("cotton", [
  { key: "heroic", label: "Heroic", families: ["heroic"] },
  { key: "confort-iv", label: "Confort IV", families: ["confort iv"] },
  { key: "confort-classic", label: "Confort classic", families: ["confort classic"] },
  { key: "bali-ii", label: "Bali II", families: ["bali ii"] },
  { key: "confort-iii", label: "Confort III", families: ["confort iii"] },
  { key: "confort-ii", label: "Confort II", families: ["confort ii"] },
  { key: "bali-iii", label: "Bali III", families: ["bali iii"] },
  { key: "desert", label: "Desert", families: ["desert"] },
  { key: "olimpiada", label: "Olimpiada", families: ["olimpiada"] },
  { key: "montana", label: "Montana", families: ["montana"] },
  { key: "combi-street", label: "Combi street", families: ["combi street"] },
  { key: "universo", label: "Universo", families: ["universo"] },
  { key: "versalles", label: "Versalles", families: ["versalles"] },
  { key: "jungle", label: "Jungle", families: ["jungle"] },
  { key: "lille", label: "Lille", families: ["lille"] },
  { key: "pasarela-travel", label: "Pasarela travel", families: ["pasarela travel", "pasarela"] },
  {
    key: "pants",
    label: "Pants",
    families: ["pants", "long pants", "pants / shorts"],
    pattern: /\bpants\b/,
  },
]);

/* ─── Entrenador children (PDF Man Teamwear → Entrenador) ─── */

const COACH_CHILDREN: readonly JomaFolderDef[] = [
  { key: "coach-pasarela", label: "Pasarela", families: ["pasarela"], pattern: /\bpasarela\b/ },
  { key: "coach-bali-ii", label: "Bali II", families: ["bali ii"], pattern: /\bbali ii\b/ },
  { key: "coach-confort-classic", label: "Confort classic", families: ["confort classic"], pattern: /\bconfort classic\b/ },
  { key: "coach-bali-iii", label: "Bali III", families: ["bali iii"], pattern: /\bbali iii\b/ },
  { key: "coach-hobby", label: "Hobby", families: ["hobby"], pattern: /\bhobby\b/ },
];

/* ─── Portero children (PDF Man Teamwear → Portero) ─── */

const KEEPER_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "keeper-set",
    label: "Set",
    families: ["keeper set"],
    pattern: /\bkeeper set\b|\bset\b.{0,24}\b(keeper|portero|goalkeeper|goalie)\b|\b(keeper|portero|goalkeeper|goalie)\b.{0,24}\bset\b/,
  },
  {
    key: "keeper-gloves",
    label: "Gloves",
    sub: "gk-gloves",
    families: ["gloves", "goalkeeper gloves"],
    pattern: /\b(glove|goalkeeper)\b/,
  },
  {
    key: "keeper-accessories",
    label: "Accessories",
    // Catch-all preserves the previous flat Portero matches.
    pattern: /\b(portero|portera|goalkeeper|goalie)\b/,
  },
];

/* ─── Football / Futsal apparel collections (PDF Man/Woman Teamwear) ─── */

const FOOTBALL_TSHIRT_COLLECTIONS: readonly JomaFolderDef[] = [
  { key: "twfb-championship-20", label: "Championship 20", families: ["championship 20"], pattern: /\bchampionship 20\b/ },
  { key: "twfb-heroic", label: "Heroic", families: ["heroic"], pattern: /\bheroic\b/ },
  { key: "twfb-winner-iv", label: "Winner IV", families: ["winner iv"], pattern: /\bwinner iv\b/ },
  { key: "twfb-inter-vi", label: "Inter VI", families: ["inter vi"], pattern: /\binter vi\b/ },
  { key: "twfb-tiger-viii", label: "Tiger VIII", families: ["tiger viii"], pattern: /\btiger viii\b/ },
  { key: "twfb-picasho-city", label: "Picasho City", families: ["picasho city", "picasho"], pattern: /\bpicasho(\s+city)?\b/ },
  { key: "twfb-toletum-vii", label: "Toletum VII", families: ["toletum vii"], pattern: /\btoletum vii\b/ },
  { key: "twfb-championship-viii", label: "Championship VIII", families: ["championship viii"], pattern: /\bchampionship viii\b/ },
  { key: "twfb-eco-retro", label: "Eco-Retro", families: ["eco-retro", "eco retro"], pattern: /\beco[-. ]?retro\b/ },
  { key: "twfb-inter-v", label: "Inter V", families: ["inter v"], pattern: /\binter v\b/ },
  { key: "twfb-tiger-vii", label: "Tiger VII", families: ["tiger vii"], pattern: /\btiger vii\b/ },
  { key: "twfb-toletum-vi", label: "Toletum VI", families: ["toletum vi"], pattern: /\btoletum vi\b/ },
  { key: "twfb-europa-vi", label: "Europa VI", families: ["europa vi"], pattern: /\beuropa vi\b/ },
  { key: "twfb-danubio-iv", label: "Danubio IV", families: ["danubio iv"], pattern: /\bdanubio iv\b/ },
  { key: "twfb-dinamo", label: "Dinamo", families: ["dinamo"], pattern: /\bdinamo\b/ },
  { key: "twfb-winner-iii", label: "Winner III", families: ["winner iii"], pattern: /\bwinner iii\b/ },
  { key: "twfb-championship-vii", label: "Championship VII", families: ["championship vii"], pattern: /\bchampionship vii\b/ },
  { key: "twfb-toledo", label: "Toledo", families: ["toledo"], pattern: /\btoledo\b/ },
  { key: "twfb-lion-ii", label: "Lion II", families: ["lion ii"], pattern: /\blion ii\b/ },
  { key: "twfb-toletum-v", label: "Toletum V", families: ["toletum v"], pattern: /\btoletum v\b/ },
  { key: "twfb-tiger-vi", label: "Tiger VI", families: ["tiger vi"], pattern: /\btiger vi\b/ },
  { key: "twfb-fit-one-ii", label: "Fit One II", families: ["fit one ii"], pattern: /\bfit one ii\b/ },
  { key: "twfb-proteam", label: "Proteam", families: ["proteam", "proteam ii"], pattern: /\bproteam\b/ },
  { key: "twfb-inter-iii", label: "Inter III", families: ["inter iii"], pattern: /\binter iii\b/ },
  { key: "twfb-gold-vii", label: "Gold VII", families: ["gold vii"], pattern: /\bgold vii\b/ },
  { key: "twfb-city-ii", label: "City II", families: ["city ii"], pattern: /\bcity ii\b/ },
  { key: "twfb-inter-ii", label: "Inter II", families: ["inter ii"], pattern: /\binter ii\b/ },
  { key: "twfb-pisa-ii", label: "Pisa II", families: ["pisa ii"], pattern: /\bpisa ii\b/ },
  { key: "twfb-europa-v", label: "Europa V", families: ["europa v"], pattern: /\beuropa v\b/ },
  { key: "twfb-crew-v", label: "Crew V", families: ["crew v"], pattern: /\bcrew v\b/ },
  { key: "twfb-flag-iii", label: "Flag III", families: ["flag iii"], pattern: /\bflag iii\b/ },
  { key: "twfb-supernova-iv", label: "Supernova IV", families: ["supernova iv"], pattern: /\bsupernova iv\b/ },
  { key: "twfb-tiger-v", label: "Tiger V", families: ["tiger v"], pattern: /\btiger v\b/ },
  { key: "twfb-inter-classic", label: "Inter Classic", families: ["inter classic"], pattern: /\binter classic\b/ },
  { key: "twfb-inter-iv", label: "Inter IV", families: ["inter iv"], pattern: /\binter iv\b/ },
  { key: "twfb-olimpiada", label: "Olimpiada", families: ["olimpiada"], pattern: /\bolimpiada\b/ },
  { key: "twfb-academy-iii", label: "Academy III", families: ["academy iii"], pattern: /\bacademy iii\b/ },
  { key: "twfb-academy-iv", label: "Academy IV", families: ["academy iv"], pattern: /\bacademy iv\b/ },
  { key: "twfb-combi", label: "Combi", families: ["combi"], pattern: /\bcombi\b/ },
  { key: "twfb-combi-premium", label: "Combi Premium", families: ["combi premium"], pattern: /\bcombi premium\b/ },
  { key: "twfb-eventos", label: "Eventos", families: ["eventos"], pattern: /\beventos\b/ },
  { key: "twfb-winner", label: "Winner", families: ["winner"], pattern: /\bwinner\b/ },
  { key: "twfb-championship-2-0", label: "Championship 2.0", families: ["championship 2.0"], pattern: /\bchampionship 2\.0\b/ },
  { key: "twfb-eco-championship", label: "Eco Championship", families: ["eco championship"], pattern: /\beco championship\b/ },
  { key: "twfb-winner-ii", label: "Winner II", families: ["winner ii"], pattern: /\bwinner ii\b/ },
  { key: "twfb-championship-vi", label: "Championship VI", families: ["championship vi"], pattern: /\bchampionship vi\b/ },
];

const FOOTBALL_SET_COLLECTIONS: readonly JomaFolderDef[] = [
  { key: "twfs-new-area", label: "Set New Area", families: ["set new area", "new area set"], pattern: /\b(new area set|set new area)\b/ },
  { key: "twfs-phoenix-iii", label: "Set Phoenix III", families: ["set phoenix iii", "phoenix iii set"], pattern: /\b(set phoenix iii|phoenix iii set)\b/ },
  { key: "twfs-lider", label: "Set Lider", families: ["set lider", "lider set"], pattern: /\b(set lider|lider set)\b/ },
  { key: "twfs-liga-pro", label: "Set Liga Pro", families: ["set liga pro", "liga pro"], pattern: /\b(set liga pro|liga pro)\b/ },
  { key: "twfs-victory", label: "Set Victory", families: ["set victory", "victory set"], pattern: /\b(set victory|victory set)\b/ },
  { key: "twfs-danubio-iii", label: "Set Danubio III", families: ["set danubio iii", "danubio iii set"], pattern: /\b(set danubio iii|danubio iii set)\b/ },
  { key: "twfs-inter-classic", label: "Set Inter Classic", families: ["set inter classic", "inter classic"], pattern: /\b(set inter classic|inter classic)\b/ },
  { key: "twfs-phoenix", label: "Set Phoenix", families: ["set phoenix", "phoenix set"], pattern: /\b(set phoenix|phoenix set)\b/ },
];

const TEAMWEAR_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "training-polyester",
    label: "Training Polyester",
    children: POLYESTER_COLLECTIONS,
  },
  {
    key: "training-cotton",
    label: "Training Cotton",
    children: COTTON_COLLECTIONS,
  },
  {
    key: "outerwear",
    label: "Outerwear",
    children: [
      {
        key: "anorak-jackets",
        label: "Anorak/Jackets",
        families: ["anorak", "jackets", "jacket", "parka", "puffer"],
        pattern: /\b(anorak|parka|puffer|down jacket|bomber)\b/,
      },
      {
        key: "raincoats-windbreakers",
        label: "Chubasqueros/Windbreakers",
        families: ["chubasqueros", "windbreakers", "raincoat", "rain jacket", "cortavientos"],
        pattern: /\b(raincoat|windbreaker|chubasquero|cortavientos|rain jacket)\b/,
      },
      {
        key: "soft-shell-polar",
        label: "Soft Shell/Polar",
        families: [
          "soft shell",
          "softshell",
          "polar",
          "fleece",
          "matterhorn",
          "bern",
          "basel",
          "teal",
        ],
        pattern: /\b(soft[- ]?shell|polar|fleece|matterhorn|bern|basel|teal)\b/,
      },
    ],
  },
  {
    key: "tw-football",
    label: "Football / Futsal",
    children: [
      {
        key: "tw-football-tshirts",
        label: "T-shirt",
        children: FOOTBALL_TSHIRT_COLLECTIONS,
      },
      {
        key: "tw-football-sets",
        label: "Set",
        children: FOOTBALL_SET_COLLECTIONS,
      },
      {
        key: "tw-football-outlet",
        label: "Outlet",
        families: ["outlet"],
        pattern: /\boutlet\b/,
      },
      {
        key: "tw-pants-corto",
        label: "Pants corto",
        families: ["pants corto"],
        pattern: /\bpants corto\b/,
      },
      {
        key: "tw-medias",
        label: "Medias",
        families: ["medias"],
        pattern: /\bmedias\b/,
      },
      {
        key: "tw-accessories",
        label: "Accessories",
        children: [
          {
            key: "tw-football-balls",
            label: "Balls",
            families: ["balls"],
            pattern: /\bballs?\b/,
          },
          {
            key: "tw-football-acc-football",
            label: "Accessories of Football",
            families: ["accessories of football"],
            pattern: /\baccessories of football\b/,
          },
        ],
      },
    ],
  },
  {
    key: "tw-basketball",
    label: "Basketball",
    children: collectionLeaves("twb", [
      { key: "phoenix-iii", label: "Phoenix III", families: ["phoenix iii"] },
      { key: "final-four-set", label: "Final Four Set", families: ["final four set"] },
      { key: "lider-set", label: "Lider Set", families: ["lider set", "líder set"] },
      { key: "cancha", label: "Cancha", families: ["cancha"] },
      { key: "final-ii-set", label: "Final II Set", families: ["final ii set"] },
      { key: "atlanta-set", label: "Atlanta Set", families: ["atlanta set"] },
      { key: "cancha-iii", label: "Cancha III", families: ["cancha iii"] },
      { key: "kansas-set", label: "Kansas Set (reversible)", families: ["kansas set", "kansas"] },
      { key: "olimpiada-set", label: "Olimpiada Set", families: ["olimpiada set"] },
      { key: "aro", label: "Aro (reversible)", families: ["aro"] },
      { key: "combi", label: "Combi", sport: "basketball", families: ["combi"] },
      { key: "pants", label: "Pants", sport: "basketball", families: ["pants", "long pants", "shorts", "short"] },
      { key: "accessories", label: "Accessories", sport: "basketball", families: ["accessories", "socks"] },
    ]),
  },
  {
    key: "tw-rugby",
    label: "Rugby",
    children: collectionLeaves("twr", [
      { key: "phoenix-iii", label: "Phoenix III", sport: "rugby", families: ["phoenix iii"] },
      { key: "myskin-iii", label: "Myskin III", families: ["myskin iii"] },
      { key: "stimulus", label: "Stimulus", sport: "rugby", families: ["stimulus"] },
      { key: "nation", label: "Nation", families: ["nation"] },
      { key: "teamwork", label: "Teamwork", families: ["teamwork"] },
      { key: "skrum", label: "Skrum", families: ["skrum"] },
      { key: "olimpiada", label: "Olimpiada", sport: "rugby", families: ["olimpiada"] },
      { key: "strong", label: "Strong", families: ["strong"] },
      {
        key: "pants",
        label: "Pants",
        sport: "rugby",
        families: ["pants", "long pants", "shorts", "short", "long trousers"],
        pattern: /\b(shorts|trousers|bermuda)\b/,
      },
      {
        key: "accessories",
        label: "Accessories",
        sport: "rugby",
        families: ["accessories", "socks", "balls"],
        pattern: /\b(socks?|balls?|scrum cap)\b/,
      },
    ]),
    cover: "/brand/hub-rugby.png?v=1",
  },
  {
    key: "tw-volleyball",
    label: "Volleyball",
    children: collectionLeaves("twv", [
      { key: "championship-20", label: "Championship 20", families: ["championship 20"] },
      { key: "winner-iv", label: "Winner IV", families: ["winner iv"] },
      { key: "championship-viii", label: "Championship VIII", families: ["championship viii"] },
      { key: "academy-iii", label: "Academy III", families: ["academy iii"] },
      { key: "academy-iv", label: "Academy IV", families: ["academy iv"] },
      { key: "combi-premium", label: "Combi premium", families: ["combi premium"] },
      { key: "accessories", label: "Accessories", sport: "volleyball", families: ["accessories"] },
    ]),
  },
  {
    key: "tw-handball",
    label: "Handball",
    children: collectionLeaves("twh", [
      { key: "phoenix-iii", label: "Phoenix III", families: ["phoenix iii"] },
      { key: "winner-iv", label: "Winner IV", families: ["winner iv"] },
      { key: "championship-viii", label: "Championship VIII", families: ["championship viii"] },
      { key: "dinamo-ii", label: "Dinamo II", families: ["dinamo ii"] },
      { key: "dinamo", label: "Dinamo", families: ["dinamo"] },
      { key: "hispa-v", label: "Hispa V", families: ["hispa v"] },
      { key: "teamwork", label: "Teamwork", families: ["teamwork"] },
      { key: "championship-vii", label: "Championship VII", families: ["championship vii"] },
      { key: "olimpiada", label: "Olimpiada", families: ["olimpiada"] },
      { key: "strong", label: "Strong", families: ["strong"] },
      { key: "combi-premium", label: "Combi premium", families: ["combi premium"] },
      { key: "accessories", label: "Accessories", sport: "handball", families: ["accessories"] },
    ]),
  },
  {
    key: "tw-coach",
    label: "Entrenador",
    children: COACH_CHILDREN,
  },
  {
    key: "tw-arbitro",
    label: "Árbitro",
    families: ["arbitro", "referee"],
    pattern: /\b(arbitro|árbitro|referee)\b/,
  },
  {
    key: "tw-keeper",
    label: "Portero",
    children: KEEPER_CHILDREN,
  },
  {
    key: "tw-cricket",
    label: "Cricket",
    families: ["cricket"],
    pattern: /\bcricket\b/,
  },
  {
    key: "tw-swimming",
    label: "Swimming",
    families: ["swimming", "swimwear"],
    pattern: /\b(swim|swimming)\b/,
  },
  {
    key: "tw-pants",
    label: "Pants",
    families: ["pants", "long pants", "pants / shorts", "shorts"],
    pattern: /\b(pants|trousers|shorts|bermuda)\b/,
  },
];

/* ─── Woman Teamwear (PDF Woman — audience-scoped, `wtw`/`w`-prefixed keys) ─── */

const WOMAN_POLYESTER_COLLECTIONS = collectionLeaves("wpoly", [
  { key: "championship-2-0", label: "Championship 2.0", families: ["championship 2.0"] },
  { key: "heroic", label: "Heroic", families: ["heroic"] },
  { key: "picasho-city", label: "Picasho city", families: ["picasho city", "picasho"] },
  { key: "toletum-vii", label: "Toletum VII", families: ["toletum vii"] },
  { key: "tiger-viii", label: "Tiger VIII", families: ["tiger viii"] },
  { key: "new-area-set", label: "New area set", families: ["new area set", "set new area"] },
  { key: "phoenix-iii-set", label: "Phoenix III set", families: ["phoenix iii set", "set phoenix iii"] },
  { key: "winner-iv", label: "Winner IV", families: ["winner iv"] },
  { key: "inter-vi", label: "Inter VI", families: ["inter vi"] },
  { key: "championship-viii", label: "Championship VIII", families: ["championship viii"] },
  { key: "eco-retro", label: "Eco-retro", families: ["eco-retro", "eco retro"] },
  { key: "lider", label: "Lider", families: ["lider", "líder"] },
  { key: "crew-v", label: "Crew V", families: ["crew v"] },
  { key: "eco-championship", label: "Eco Championship", families: ["eco championship"] },
  { key: "eco-supernova", label: "Eco Supernova", families: ["eco supernova"] },
  { key: "winner-ii", label: "Winner II", families: ["winner ii"] },
  { key: "supenova-iii", label: "Supenova III", families: ["supenova iii"] },
  { key: "siena-diana", label: "Siena & Diana", families: ["siena", "diana"] },
  { key: "combi", label: "Combi", families: ["combi"] },
  { key: "combi-premium", label: "Combi premium", families: ["combi premium"] },
  { key: "academy-iv", label: "Academy IV", families: ["academy iv"] },
  { key: "hobby", label: "Hobby", families: ["hobby"] },
  { key: "phoenix-set", label: "Phoenix set", families: ["phoenix set", "set phoenix"] },
  {
    key: "pants",
    label: "Pants",
    families: ["pants", "long pants", "pants / shorts"],
    pattern: /\bpants\b/,
  },
]);

const WOMAN_COTTON_COLLECTIONS = collectionLeaves("wcotton", [
  { key: "heroic", label: "Heroic", families: ["heroic"] },
  { key: "oasis", label: "Oasis", families: ["oasis"] },
  { key: "versalles", label: "Versalles", families: ["versalles"] },
  { key: "bali-ii", label: "Bali II", families: ["bali ii"] },
  { key: "bali-iii", label: "Bali III", families: ["bali iii"] },
  { key: "oasis-ii", label: "Oasis II", families: ["oasis ii"] },
  { key: "desert", label: "Desert", families: ["desert"] },
  { key: "olimpiada", label: "Olimpiada", families: ["olimpiada"] },
  { key: "sweatshirts", label: "Sweatshirts", families: ["sweatshirts", "sweatshirt"] },
  {
    key: "pants",
    label: "Pants",
    families: ["pants", "long pants", "pants / shorts"],
    pattern: /\bpants\b/,
  },
]);

const WOMAN_JERSEYS_SET_COLLECTIONS = collectionLeaves("wfbj", [
  { key: "championship-20", label: "Championship 20", families: ["championship 20"] },
  { key: "toletum-vii", label: "Toletum VII", families: ["toletum vii"] },
  { key: "heroic", label: "Heroic", families: ["heroic"] },
  { key: "picasho-city", label: "Picasho City", families: ["picasho city", "picasho"] },
  { key: "championship-viii", label: "Championship VIII", families: ["championship viii"] },
  { key: "set-lider", label: "Set Lider", families: ["set lider", "lider set"] },
  { key: "eco-championship", label: "Eco Championship", families: ["eco championship"] },
  { key: "crew-v", label: "Crew V", families: ["crew v"] },
  { key: "supernova-iv", label: "Supernova IV", families: ["supernova iv"] },
  { key: "winner-ii", label: "Winner II", families: ["winner ii"] },
  { key: "championship-vi", label: "Championship VI", families: ["championship vi"] },
  { key: "combi-premium", label: "Combi Premium", families: ["combi premium"] },
  { key: "academy-iv", label: "Academy IV", families: ["academy iv"] },
  { key: "academy-iii", label: "Academy III", families: ["academy iii"] },
  { key: "combi", label: "Combi", families: ["combi"] },
  { key: "set-phoenix", label: "Set Phoenix", families: ["set phoenix", "phoenix set"] },
]);

const WOMAN_KEEPER_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "wk-set",
    label: "Set",
    families: ["keeper set"],
    pattern: /\bkeeper set\b|\bset\b.{0,24}\b(keeper|portero|goalkeeper|goalie)\b|\b(keeper|portero|goalkeeper|goalie)\b.{0,24}\bset\b/,
  },
  {
    key: "wk-gloves",
    label: "Gloves",
    sub: "gk-gloves",
    families: ["gloves", "goalkeeper gloves"],
    pattern: /\b(glove|goalkeeper)\b/,
  },
  {
    key: "wk-accessories",
    label: "Accessories",
    pattern: /\b(portero|portera|goalkeeper|goalie)\b/,
  },
];

const WOMAN_TEAMWEAR_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "wtw-polyester",
    label: "Training Polyester",
    children: WOMAN_POLYESTER_COLLECTIONS,
  },
  {
    key: "wtw-cotton",
    label: "Training Cotton",
    children: WOMAN_COTTON_COLLECTIONS,
  },
  {
    key: "wtw-outerwear",
    label: "Outerwear",
    children: [
      {
        key: "wouter-anoraks",
        label: "Anoraks/Jackets",
        families: ["anorak", "jackets", "jacket", "parka", "puffer"],
        pattern: /\b(anorak|parka|puffer|down jacket|bomber)\b/,
      },
      {
        key: "wouter-chubasqueros",
        label: "Chubasqueros",
        families: ["chubasqueros", "windbreakers", "raincoat", "rain jacket", "cortavientos"],
        pattern: /\b(raincoat|windbreaker|chubasquero|cortavientos|rain jacket)\b/,
      },
    ],
  },
  {
    key: "wtw-football",
    label: "Football/Futsal",
    children: [
      {
        key: "wtw-jerseys-set",
        label: "Jerseys & Set",
        children: WOMAN_JERSEYS_SET_COLLECTIONS,
      },
      {
        key: "wtw-pants-corto",
        label: "Pants corto",
        families: ["pants corto"],
        pattern: /\bpants corto\b/,
      },
      {
        key: "wtw-medias",
        label: "Medias",
        families: ["medias"],
        pattern: /\bmedias\b/,
      },
      {
        key: "wtw-accessories",
        label: "Accessories",
        children: [
          {
            key: "wtw-football-balls",
            label: "Balls",
            families: ["balls"],
            pattern: /\bballs?\b/,
          },
          {
            key: "wtw-football-acc-football",
            label: "Accessories of Football",
            families: ["accessories of football"],
            pattern: /\baccessories of football\b/,
          },
        ],
      },
    ],
  },
  {
    key: "wtw-basketball",
    label: "Basketball",
    children: collectionLeaves("wb", [
      { key: "championship-20", label: "Championship 20", families: ["championship 20"] },
      { key: "final-four-set", label: "Final four set", families: ["final four set"] },
      { key: "lider-set", label: "Lider Set", families: ["lider set", "líder set"] },
      { key: "cancha", label: "Cancha", families: ["cancha"] },
      { key: "final-ii-set", label: "Final II set", families: ["final ii set"] },
      { key: "cancha-iii", label: "Cancha III", families: ["cancha iii"] },
      { key: "phoenix-iii", label: "Phoenix III", families: ["phoenix iii"] },
      { key: "combi", label: "Combi", families: ["combi"] },
      { key: "kansas-set", label: "Kansas set reversible", families: ["kansas set", "kansas"] },
      { key: "aro", label: "Aro reversible", families: ["aro"] },
      { key: "olimpiada-set", label: "Olimpiada set", families: ["olimpiada set"] },
      { key: "pants-corto", label: "Pants corto", sport: "basketball", families: ["pants corto"] },
      { key: "accessories", label: "Accessories", sport: "basketball", families: ["accessories", "socks"] },
    ]),
  },
  {
    key: "wtw-rugby",
    label: "Rugby",
    children: collectionLeaves("wr", [
      { key: "phoenix-iii", label: "Phoenix III", sport: "rugby", families: ["phoenix iii"] },
      { key: "myskin-iii", label: "Myskin III", families: ["myskin iii"] },
      { key: "stimulus", label: "Stimulus", sport: "rugby", families: ["stimulus"] },
      { key: "nation", label: "Nation", families: ["nation"] },
      { key: "teamwork", label: "Teamwork", families: ["teamwork"] },
      { key: "skrum", label: "Skrum", families: ["skrum"] },
      { key: "olimpiada", label: "Olimpiada", sport: "rugby", families: ["olimpiada"] },
      { key: "strong", label: "Strong", families: ["strong"] },
      {
        key: "pants",
        label: "Pants",
        sport: "rugby",
        families: ["pants", "long pants", "shorts", "short", "long trousers"],
        pattern: /\b(shorts|trousers|bermuda)\b/,
      },
      {
        key: "accessories",
        label: "Accessories",
        sport: "rugby",
        families: ["accessories", "socks", "balls"],
        pattern: /\b(socks?|balls?|scrum cap)\b/,
      },
    ]),
  },
  {
    key: "wtw-volleyball",
    label: "Volleyball",
    children: collectionLeaves("wv", [
      { key: "championship-20", label: "Championship 20", families: ["championship 20"] },
      { key: "winner-iv", label: "Winner IV", families: ["winner iv"] },
      { key: "championship-viii", label: "Championship VIII", families: ["championship viii"] },
      { key: "dinamo", label: "Dinamo", families: ["dinamo"] },
      { key: "academy-iv", label: "Academy IV", families: ["academy iv"] },
      { key: "academy", label: "Academy", families: ["academy"] },
      { key: "combi-premium", label: "Combi premium", families: ["combi premium"] },
      { key: "accessories", label: "Accessories", sport: "volleyball", families: ["accessories"] },
    ]),
  },
  {
    key: "wtw-handball",
    label: "Handball",
    children: collectionLeaves("wh", [
      { key: "championship-20", label: "Championship 20", families: ["championship 20"] },
      { key: "phoenix-iii-set", label: "Phoenix III set", families: ["phoenix iii set"] },
      { key: "winner-iv", label: "Winner IV", families: ["winner iv"] },
      { key: "championship-viii", label: "Championship VIII", families: ["championship viii"] },
      { key: "dinamo-ii", label: "Dinamo II", families: ["dinamo ii"] },
      { key: "dinamo", label: "Dinamo", families: ["dinamo"] },
      { key: "hispa-v", label: "Hispa V", families: ["hispa v"] },
      { key: "teamwork", label: "Teamwork", families: ["teamwork"] },
      { key: "olimpiada", label: "Olimpiada", families: ["olimpiada"] },
      { key: "combi-premium", label: "Combi premium", families: ["combi premium"] },
      { key: "accessories", label: "Accessories", sport: "handball", families: ["accessories"] },
    ]),
  },
  {
    key: "wtw-cricket",
    label: "Cricket",
    families: ["cricket"],
    pattern: /\bcricket\b/,
  },
  {
    key: "wtw-keeper",
    label: "Portero",
    children: WOMAN_KEEPER_CHILDREN,
  },
  {
    key: "wtw-arbitro",
    label: "Árbitro",
    families: ["arbitro", "referee"],
    pattern: /\b(arbitro|árbitro|referee)\b/,
  },
  {
    key: "wtw-coach",
    label: "Entrenador",
    families: ["coach", "entrenador"],
    pattern: /\b(coach|entrenador)\b/,
  },
  {
    key: "wtw-swimming",
    label: "Swimming",
    families: ["swimming", "swimwear"],
    pattern: /\b(swim|swimming)\b/,
  },
  {
    key: "wtw-pants",
    label: "Pants",
    families: ["pants", "long pants", "pants / shorts", "shorts"],
    pattern: /\b(pants|trousers|shorts|bermuda)\b/,
  },
];

/**
 * Teamwear Pro 2026 sport folders (Man and Woman share this list).
 * Football stays on the pro world-cup filing (`teampro-2026`).
 * The other sports are not filed under that hub in this catalog — their SKUs
 * already live on the sport hub or under the sport's item family. Matching
 * those keeps Rugby / Basketball / Handball / Volleyball / Running / Training /
 * Travel from rendering an empty men filter.
 */
const RUNNING_LINE_FAMILIES = [
  "r-city",
  "r-city fall",
  "r-city winter",
  "r-trail",
  "r-night",
  "r-nature",
  "record pro",
  "record ii",
] as const;

const TEAMWEAR_PRO_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "tp-football",
    label: "Football",
    category: "teampro-2026",
    families: ["montreal 2026", "montreal 26", "montreal", "mundial 2026", "mundial"],
    pattern: /\b(football|futsal)\b/,
    cover: "/brand/hub-lifestyle.png?v=1",
  },
  {
    key: "tp-basketball",
    label: "Basketball",
    hubs: ["basketball"],
    families: ["cancha", "cancha iii", "final four set", "atlanta set", "kansas set", "aro"],
    apparelOnly: true,
  },
  {
    key: "tp-running",
    label: "Running",
    exactFamilies: RUNNING_LINE_FAMILIES,
    apparelOnly: true,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "tp-rugby",
    label: "Rugby",
    hubs: ["rugby"],
    apparelOnly: true,
    cover: "/brand/hub-rugby.png?v=1",
  },
  {
    key: "tp-handball",
    label: "Handball",
    families: ["handball", "handball woman", "hispa v", "hispa"],
    pattern: /\b(handball|hispa)\b/,
    apparelOnly: true,
  },
  {
    key: "tp-volleyball",
    label: "Volleyball",
    exactFamilies: ["volleyball", "volley", "volley woman"],
    apparelOnly: true,
  },
  {
    key: "tp-training",
    label: "Training",
    exactFamilies: ["training"],
    apparelOnly: true,
    cover: "/brand/hub-teampro-2026.png",
  },
  {
    key: "tp-travel",
    label: "Travel",
    exactFamilies: ["travel", "pasarela", "pasarela travel"],
    apparelOnly: true,
  },
];

/** Running / Trail — season + collection folders (PDF). */
const RUNNING_TRAIL_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "rt-new-ss27",
    label: "New SS27",
    children: collectionLeaves("rt-new", [
      { key: "r-city", label: "R-City", families: ["r-city"], pattern: /\br-city\b/ },
      { key: "r-trail", label: "R-Trail", families: ["r-trail"], pattern: /\br-trail\b/ },
    ]),
  },
  {
    key: "rt-in-stock",
    label: "In stock",
    children: collectionLeaves("rt-stock", [
      {
        key: "r-city-fall",
        label: "R-City Fall",
        families: ["r-city fall"],
        pattern: /\br-city fall\b/,
      },
      {
        key: "r-city-winter",
        label: "R-City Winter",
        families: ["r-city winter"],
        pattern: /\br-city winter\b/,
      },
      { key: "r-night", label: "R-Night", families: ["r-night"], pattern: /\br-night\b/ },
      { key: "r-trail", label: "R-Trail", families: ["r-trail"], pattern: /\br-trail\b/ },
    ]),
  },
  {
    key: "rt-previous",
    label: "Previous collections",
    children: collectionLeaves("rt-prev", [
      { key: "r-nature", label: "R-Nature", families: ["r-nature"], pattern: /\br-nature\b/ },
      { key: "r-night", label: "R-Night", families: ["r-night"], pattern: /\br-night\b/ },
      { key: "r-city", label: "R-City", families: ["r-city"], pattern: /\br-city\b/ },
    ]),
  },
  {
    key: "rt-teamwear-collections",
    label: "Teamwear collections",
    children: collectionLeaves("rt-tw", [
      { key: "picasho-city", label: "Picasho City", families: ["picasho city", "picasho"] },
      { key: "record-pro", label: "Record Pro", families: ["record pro"] },
      { key: "elite-xi", label: "Élite XI", families: ["elite xi", "élite xi"] },
      { key: "elite-x", label: "Élite X", families: ["elite x", "élite x"] },
      { key: "elite-ix", label: "Élite IX", families: ["elite ix", "élite ix"] },
      { key: "record-ii", label: "Record II", families: ["record ii"] },
      { key: "basicos", label: "Básicos", families: ["basicos", "básicos"] },
    ]),
  },
];

/** Cycling season folders (PDF). */
const CYCLING_CHILDREN: readonly JomaFolderDef[] = collectionLeaves("cyc", [
  {
    key: "ss27",
    label: "Spring Summer 2027",
    families: ["spring summer 2027", "ss27"],
    pattern: /\b(spring summer 2027|ss\s*27)\b/,
  },
  {
    key: "fw26",
    label: "Fall Winter 2026",
    families: ["fall winter 2026", "fw26"],
    pattern: /\b(fall winter 2026|fw\s*26|autumn winter)\b/,
  },
  {
    key: "previous",
    label: "Previous season",
    families: ["previous season", "cycling"],
    pattern: /\b(previous season|cycling)\b/,
  },
]);

/** Racket sports — season + teamwear collection folders (PDF). */
const RACKET_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "rk-new-ss27",
    label: "New SS27",
    children: collectionLeaves("rk-new", [
      { key: "challenge", label: "Challenge", families: ["challenge"] },
      { key: "smash", label: "Smash", families: ["smash"] },
      { key: "torneo", label: "Torneo", families: ["torneo"] },
    ]),
  },
  {
    key: "rk-in-stock",
    label: "In stock",
    children: collectionLeaves("rk-stock", [
      { key: "challenge", label: "Challenge", families: ["challenge"] },
      { key: "smash", label: "Smash", families: ["smash"] },
    ]),
  },
  {
    key: "rk-previous",
    label: "Previous collections",
    children: collectionLeaves("rk-prev", [
      { key: "challenge", label: "Challenge", families: ["challenge"] },
      { key: "smash", label: "Smash", families: ["smash"] },
      { key: "torneo", label: "Torneo", families: ["torneo"] },
    ]),
  },
  {
    key: "rk-teamwear-collections",
    label: "Teamwear collections",
    children: collectionLeaves("rk-tw", [
      { key: "terra", label: "Terra", families: ["terra"] },
      { key: "montreal-26", label: "Montreal 26", families: ["montreal 26", "montreal 2026"] },
      { key: "montreal-25", label: "Montreal 25", families: ["montreal 25", "montreal 2025"] },
      { key: "basicos", label: "Básicos", families: ["basicos", "básicos", "court"] },
    ]),
  },
];

/** Hiking / Outdoor (PDF). */
const HIKING_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "hk-ss27",
    label: "Spring Summer 2027",
    families: ["spring summer 2027", "ss27"],
    pattern: /\b(spring summer 2027|ss\s*27)\b/,
  },
  {
    key: "hk-in-stock",
    label: "In stock",
    children: collectionLeaves("hk-stock", [
      { key: "explorer", label: "Explorer", families: ["explorer"], pattern: /\bexplorer\b/ },
      { key: "snow", label: "Snow", families: ["snow"], pattern: /\bsnow\b/ },
    ]),
  },
  {
    key: "hk-previous",
    label: "Previous collections",
    children: collectionLeaves("hk-prev", [
      {
        key: "outdoor",
        label: "Outdoor",
        families: ["outdoor"],
        pattern: /\b(outdoor|hiking|trekking)\b/,
      },
      { key: "snow", label: "Snow", families: ["snow"], pattern: /\bsnow\b/ },
    ]),
  },
];

/** Fitness / Gym (PDF). */
const FITNESS_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "fit-new",
    label: "New collections",
    children: collectionLeaves("fit-new", [
      {
        key: "fitness-gym",
        label: "Fitness / Gym",
        families: ["fitness / gym", "fitness", "gym"],
        pattern: /\b(fitness|gym)\b/,
      },
      { key: "soft", label: "Soft", pattern: /\bsoft\b(?![\s-]*shell)/ },
    ]),
  },
  {
    key: "fit-in-stock",
    label: "In stock",
    children: collectionLeaves("fit-stock", [
      {
        key: "indoor-gym",
        label: "Indoor Gym",
        families: ["indoor gym", "indoor"],
        pattern: /\b(indoor gym|r-indoor)\b/,
      },
      { key: "soft", label: "Soft", pattern: /\bsoft\b(?![\s-]*shell)/ },
    ]),
  },
  {
    key: "fit-previous",
    label: "Previous collections",
    children: collectionLeaves("fit-prev", [
      {
        key: "indoor",
        label: "Indoor",
        families: ["indoor", "r-indoor"],
        pattern: /\b(indoor|r-indoor)\b/,
      },
      { key: "soft", label: "Soft", pattern: /\bsoft\b(?![\s-]*shell)/ },
    ]),
  },
];

/** Lifestyle apparel (PDF Man/Woman). */
const LIFESTYLE_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "ls-ss27",
    label: "Spring Summer 2027",
    families: ["spring summer 2027", "ss27"],
    pattern: /\b(spring summer 2027|ss\s*27)\b/,
  },
  {
    key: "ls-in-stock",
    label: "In stock",
    children: collectionLeaves("ls-stock", [
      { key: "mimetic", label: "Mimetic", families: ["mimetic"], pattern: /\bmimetic\b/ },
      { key: "step", label: "Step", families: ["step"], pattern: /\bstep\b/ },
      {
        key: "urban-aesthetics",
        label: "Urban Aesthetics",
        families: ["urban aesthetics"],
        pattern: /\burban aesthetics\b/,
      },
    ]),
  },
  {
    key: "ls-previous",
    label: "Previous season",
    families: ["previous season"],
    pattern: /\bprevious season\b/,
  },
  {
    key: "ls-basicos",
    label: "Básicos",
    children: collectionLeaves("ls-bas", [
      { key: "desert", label: "Desert", families: ["desert"] },
      { key: "versalles", label: "Versalles", families: ["versalles"] },
      { key: "montana", label: "Montana", families: ["montana"] },
      { key: "pasarela", label: "Pasarela", families: ["pasarela", "pasarela travel"] },
    ]),
  },
];

/** Underwear / Brama (PDF Man: BRAMA LINE + INTIMI only). */
const BRAMA_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "brama-line",
    label: "Brama Line",
    families: ["brama", "brama line"],
    pattern: /\bbrama\b/,
  },
  {
    key: "brama-intimi",
    label: "Intimi",
    families: ["intimi"],
    pattern: /\bintimi\b/,
  },
];

/** Top-level Man / Woman apparel folders from the PDF. */
export const APPAREL_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "teamwear",
    label: "Teamwear",
    children: TEAMWEAR_CHILDREN,
    cover: "/brand/hub-teampro-2026.png",
  },
  {
    key: "teamwear-pro-2026",
    label: "Teamwear Pro 2026",
    children: TEAMWEAR_PRO_CHILDREN,
    cover: "/brand/hub-teampro-2026.png",
  },
  {
    key: "running-trail",
    label: "Running / Trail",
    children: RUNNING_TRAIL_CHILDREN,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "cycling",
    label: "Cycling",
    children: CYCLING_CHILDREN,
  },
  {
    key: "racket-sports",
    label: "Racket sports",
    children: RACKET_CHILDREN,
  },
  {
    key: "hiking-outdoor",
    label: "Hiking / Outdoor",
    children: HIKING_CHILDREN,
  },
  {
    key: "fitness-gym",
    label: "Fitness / Gym",
    children: FITNESS_CHILDREN,
  },
  {
    key: "lifestyle-apparel",
    label: "Lifestyle",
    children: LIFESTYLE_CHILDREN,
  },
  {
    key: "aguila-line",
    label: "Águila Line",
    families: ["aguila line", "águila line"],
    pattern: /\b(aguila|águila)\b/,
  },
  {
    key: "resort",
    label: "Resort",
    families: ["resort"],
    pattern: /\bresort\b/,
  },
  {
    key: "beachwear",
    label: "Beachwear",
    families: ["beachwear"],
    pattern: /\bbeach(wear)?\b/,
  },
  {
    key: "underwear-brama",
    label: "Underwear / Brama",
    children: BRAMA_CHILDREN,
  },
  {
    key: "athletes-combat",
    label: "Athletes / Combat",
    families: ["athletes / combat", "combat"],
    pattern: /\b(combat|athletes)\b/,
  },
  {
    key: "elite-club",
    label: "Elite club",
    families: ["elite club"],
    pattern: /\belite club\b/,
  },
];

/* ─── Woman mid folders (PDF Woman — audience-scoped, `w`-prefixed keys) ─── */

const WOMAN_RUNNING_TRAIL_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "wrt-new",
    label: "New collections",
    children: collectionLeaves("wrt-new", [
      { key: "r-city", label: "R-City", families: ["r-city"], pattern: /\br-city\b/ },
      { key: "r-trail", label: "R-Trail", families: ["r-trail"], pattern: /\br-trail\b/ },
    ]),
  },
  {
    key: "wrt-in-stock",
    label: "In stock",
    children: collectionLeaves("wrt-stock", [
      { key: "r-city-fall", label: "R-City Fall", families: ["r-city fall"], pattern: /\br-city fall\b/ },
      { key: "r-city-winter", label: "R-City Winter", families: ["r-city winter"], pattern: /\br-city winter\b/ },
      { key: "r-night", label: "R-Night", families: ["r-night"], pattern: /\br-night\b/ },
      { key: "r-nature", label: "R-Nature", families: ["r-nature"], pattern: /\br-nature\b/ },
    ]),
  },
  {
    key: "wrt-previous",
    label: "Previous collections",
    children: collectionLeaves("wrt-prev", [
      { key: "r-nature", label: "R-Nature", families: ["r-nature"], pattern: /\br-nature\b/ },
      { key: "r-city", label: "R-City", families: ["r-city"], pattern: /\br-city\b/ },
      { key: "r-night", label: "R-Night", families: ["r-night"], pattern: /\br-night\b/ },
    ]),
  },
  {
    key: "wrt-teamwear-collections",
    label: "Teamwear collections",
    children: collectionLeaves("wrt-tw", [
      { key: "picasho-city", label: "Picasho city", families: ["picasho city", "picasho"] },
      { key: "record-pro", label: "Record pro", families: ["record pro"] },
      { key: "elite-xi", label: "Elite XI", families: ["elite xi", "élite xi"] },
      { key: "elite-x", label: "Elite X", families: ["elite x", "élite x"] },
      { key: "elite-ix", label: "Elite IX", families: ["elite ix", "élite ix"] },
      { key: "elite-vii-viii", label: "Elite VII & VIII", families: ["elite vii", "elite viii"] },
      { key: "winner-ii", label: "Winner II", families: ["winner ii"] },
      { key: "record-ii", label: "Record II", families: ["record ii"] },
    ]),
  },
];

const WOMAN_RACKET_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "wrk-new",
    label: "New collections",
    children: collectionLeaves("wrk-new", [
      { key: "challenge", label: "Challenge", families: ["challenge"] },
      { key: "smash", label: "Smash", families: ["smash"] },
      { key: "torneo", label: "Torneo", families: ["torneo"] },
    ]),
  },
  {
    key: "wrk-in-stock",
    label: "In stock",
    children: collectionLeaves("wrk-stock", [
      { key: "challenge", label: "Challenge", families: ["challenge"] },
      { key: "smash", label: "Smash", families: ["smash"] },
    ]),
  },
  {
    key: "wrk-previous",
    label: "Previous collections",
    children: collectionLeaves("wrk-prev", [
      { key: "challenge", label: "Challenge", families: ["challenge"] },
      { key: "torneo", label: "Torneo", families: ["torneo"] },
      { key: "smash", label: "Smash", families: ["smash"] },
    ]),
  },
  {
    key: "wrk-teamwear-collections",
    label: "Teamwear collections",
    children: collectionLeaves("wrk-tw", [
      { key: "terra", label: "Terra", families: ["terra"] },
      { key: "montreal-26", label: "Montreal 26", families: ["montreal 26", "montreal 2026"] },
      { key: "montreal-25", label: "Montreal 25", families: ["montreal 25", "montreal 2025"] },
      { key: "court", label: "Court", families: ["court"] },
      { key: "skirts-dresses", label: "Skirts & Dresses", families: ["skirts", "dresses"] },
      { key: "basicos", label: "Básicos", families: ["basicos", "básicos"] },
    ]),
  },
];

const WOMAN_FITNESS_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "wfit-new",
    label: "New collections",
    children: collectionLeaves("wfit-new", [
      { key: "fitness-gym", label: "Fitness / Gym", families: ["fitness / gym", "fitness", "gym"], pattern: /\b(fitness|gym)\b/ },
      { key: "soft", label: "Soft", pattern: /\bsoft\b(?![\s-]*shell)/ },
    ]),
  },
  {
    key: "wfit-in-stock",
    label: "In stock",
    children: collectionLeaves("wfit-stock", [
      { key: "indoor-gym", label: "Indoor gym", families: ["indoor gym", "indoor"], pattern: /\b(indoor gym|r-indoor)\b/ },
      { key: "soft", label: "Soft", pattern: /\bsoft\b(?![\s-]*shell)/ },
    ]),
  },
  {
    key: "wfit-previous",
    label: "Previous collections",
    children: collectionLeaves("wfit-prev", [
      { key: "r-indoor", label: "R-Indoor", families: ["r-indoor"], pattern: /\br-indoor\b/ },
      { key: "soft", label: "Soft", pattern: /\bsoft\b(?![\s-]*shell)/ },
    ]),
  },
];

const WOMAN_LIFESTYLE_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "wls-ss27",
    label: "Spring Summer 2027",
    families: ["spring summer 2027", "ss27"],
    pattern: /\b(spring summer 2027|ss\s*27)\b/,
  },
  {
    key: "wls-in-stock",
    label: "In stock",
    children: collectionLeaves("wls-stock", [
      { key: "mimetic", label: "Mimetic", families: ["mimetic"], pattern: /\bmimetic\b/ },
      { key: "step", label: "Step", families: ["step"], pattern: /\bstep\b/ },
      { key: "urban-aesthetics", label: "Urban aesthetics", families: ["urban aesthetics"], pattern: /\burban aesthetics\b/ },
    ]),
  },
  {
    key: "wls-previous",
    label: "Previous season",
    families: ["previous season"],
    pattern: /\bprevious season\b/,
  },
  {
    key: "wls-basicos",
    label: "Basicos",
    children: collectionLeaves("wls-bas", [
      { key: "montana", label: "Montana", families: ["montana"] },
      { key: "oasis-desert", label: "Oasis / Desert", families: ["oasis", "oasis ii", "desert"] },
      { key: "versalles", label: "Versalles", families: ["versalles"] },
    ]),
  },
];

const WOMAN_BRAMA_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "wbrama-line",
    label: "BRAMA LINE",
    families: ["brama", "brama line"],
    pattern: /\bbrama\b/,
  },
  {
    key: "wbrama-sujetadores",
    label: "SUJETADORES DEPORTIVOS",
    families: ["sujetadores deportivos", "sujetador"],
    pattern: /\bsujetador/,
  },
  {
    key: "wbrama-intimi",
    label: "INTIMI",
    families: ["intimi"],
    pattern: /\bintimi\b/,
  },
];

/** Woman top-level apparel folders (PDF Woman) — forked roots where Part B differs. */
export const WOMAN_APPAREL_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "teamwear-woman",
    label: "Teamwear",
    children: WOMAN_TEAMWEAR_CHILDREN,
    cover: "/brand/hub-teampro-2026.png",
  },
  {
    key: "teamwear-pro-2026",
    label: "Teamwear Pro 2026",
    children: TEAMWEAR_PRO_CHILDREN,
    cover: "/brand/hub-teampro-2026.png",
  },
  {
    key: "running-trail-woman",
    label: "Running / Trail",
    children: WOMAN_RUNNING_TRAIL_CHILDREN,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "cycling",
    label: "Cycling",
    children: CYCLING_CHILDREN,
  },
  {
    key: "racket-sports-woman",
    label: "Racket sports",
    children: WOMAN_RACKET_CHILDREN,
  },
  {
    key: "hiking-outdoor",
    label: "Hiking / Outdoor",
    children: HIKING_CHILDREN,
  },
  {
    key: "fitness-gym-woman",
    label: "Fitness / Gym",
    children: WOMAN_FITNESS_CHILDREN,
  },
  {
    key: "lifestyle-apparel-woman",
    label: "Lifestyle",
    children: WOMAN_LIFESTYLE_CHILDREN,
  },
  {
    key: "aguila-line",
    label: "Águila Line",
    families: ["aguila line", "águila line"],
    pattern: /\b(aguila|águila)\b/,
  },
  {
    key: "resort",
    label: "Resort",
    families: ["resort"],
    pattern: /\bresort\b/,
  },
  {
    key: "beachwear",
    label: "Beachwear",
    families: ["beachwear"],
    pattern: /\bbeach(wear)?\b/,
  },
  {
    key: "underwear-brama-woman",
    label: "Underwear / Brama",
    children: WOMAN_BRAMA_CHILDREN,
  },
  {
    key: "athletes-combat",
    label: "Athletes / Combat",
    families: ["athletes / combat", "combat"],
    pattern: /\b(combat|athletes)\b/,
  },
  {
    key: "elite-club",
    label: "Elite club",
    families: ["elite club"],
    pattern: /\belite club\b/,
  },
];

/** Audience-scoped apparel roots (Woman forks where Part B differs from Man). */
export function apparelFoldersForAudience(
  audience: string | null | undefined,
): readonly JomaFolderDef[] {
  return audience === "women" ? WOMAN_APPAREL_FOLDERS : APPAREL_FOLDERS;
}

/* ─── Children deep trees (PDF Children — band-prefixed keys, Part B labels) ─── */

function slugifyFolderLabel(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Part B collection leaves under a kids parent (labels verbatim, no matchers — empty OK). */
function kidsLeaves(prefix: string, labels: readonly string[]): JomaFolderDef[] {
  return labels.map((label) => ({ key: `${prefix}-${slugifyFolderLabel(label)}`, label }));
}

const K14_TSHIRTS_SET = [
  "Championship 20", "Heroic", "Winner IV", "Toletum VII", "Picasho City", "Tiger VIII",
  "Inter VI", "Championship VIII", "Phoenix III Set", "Eco-Retro", "Inter V", "Tiger VII",
  "Toletum VI", "Danubio IV", "Europa VI", "Líder Set", "Winner III", "Toletum V",
  "Championship VII", "Tiger VI", "Inter III", "Teamwork", "Victory Set", "Supernova IV",
  "Montreal", "Danubio II Set", "City II", "Europa V", "Tiger V", "Pisa II", "Inter II",
  "Toletum IV", "Crew V", "Campus III", "Flag III", "Grafity III", "Copa II", "Academy IV",
  "Academy III", "Winner", "Combi", "Combi Premium", "Olimpiada", "Inter Classic", "Inter IV",
] as const;

const K14_JACKETS = [
  "Championship 20", "Heroic", "Winner IV", "Championship VIII", "Phoenix III", "Danubio IV",
  "Eco. Retro", "Líder", "Championship VII", "Eco championship", "Winner III", "Toledo",
  "Crew V", "Supernova IV", "Winner II", "Campus III", "Supernova III", "Combi premium",
  "Winner", "Academy IV", "Combi", "Cairo II", "Doha", "Faraón", "Menfis", "Olimpiada",
  "Academy III", "Gala",
] as const;

const K14_TRACKSUIT = [
  "Heroic", "Winner IV", "Phoenix III", "Championship VIII", "Phoenix II", "Danubio IV",
  "Líder", "Championship VII", "Eco Championship", "Danubio III", "Victory", "Danubio II",
] as const;

const K610_TSHIRTS_SET = [
  "Championship 20", "Heroic", "Winner IV", "Toletum VII", "Picasho City", "Tiger VIII",
  "Inter VI", "Championship VIII", "Phoenix III Set", "Eco-Retro", "Inter V", "Tiger VII",
  "Toletum VI", "Danubio IV", "Europa VI", "Líder Set", "Winner III", "Toletum V",
  "Championship VII", "Tiger VI", "Inter III", "Teamwork", "Victory Set", "Toledo", "Lion II",
  "Tiger IV", "Danubio II", "Tiger V", "Crew V", "Supernova IV", "Montreal", "Campus III",
  "Europa V", "Flag III", "City II", "Inter II", "Copa II", "Academy IV", "Academy III",
  "Winner", "Combi", "Combi Premium", "Strong", "Olimpiada", "Inter Classic", "Inter IV",
] as const;

const K610_JACKETS = [
  "Championship 20", "Heroic", "Winner IV", "Phoenix III", "Championship VIII", "Eco-Retro",
  "Danubio IV", "Líder", "Championship VII", "Eco Championship", "Winner III", "Toledo",
  "Crew V", "Supernova IV", "Campus III", "Supernova III", "Winner II", "Academy IV", "Winner",
  "Combi", "Cairo II", "Doha", "Menfis", "Faraón", "Olimpiada", "Gala", "Combi Premium",
] as const;

const K610_TRACKSUIT = [
  "Heroic", "Winner IV", "Phoenix III", "Championship VIII", "Phoenix II", "Danubio IV",
  "Líder", "Championship VII", "Eco Championship", "Danubio III", "Victory", "Lion II",
  "Danubio II", "Academy IV",
] as const;

const K1214B_TSHIRTS_SET = [
  "Championship 20", "Heroic", "Heroic Cotton", "Winner IV", "Phoenix III", "Toletum VII",
  "Picasho City", "Tiger VIII", "Inter VI", "Championship VIII", "New Area Set", "Eco-Retro",
  "Inter V", "Líder", "Tiger VII", "Toletum VI", "Danubio IV", "Europa VI", "Dinamo",
  "Victory Set", "Toledo", "Winner III", "Toletum V", "Championship VII", "Tiger VI", "Lion II",
  "Fit One II", "Proteam II", "Inter III", "Gold VII", "Supernova IV", "Danubio II", "Montreal",
  "City II", "Europa V", "Tiger V", "Inter II", "Flag III", "Crew V", "Copa II", "Campus III",
  "Combi", "Combi Premium", "Olimpiada", "Academy III", "Inter IV", "Inter Classic", "Winner",
  "Academy IV", "Táctica", "Hobby", "Bali III Cotton",
] as const;

const K1214B_JACKETS = [
  "Championship 20", "Heroic", "Heroic Cotton", "Phoenix III", "Winner IV", "Championship VIII",
  "Eco-Retro", "Danubio IV", "Líder", "Winner III", "Championship VII", "Eco Championship",
  "Toledo", "Winner II", "Crew V", "Supernova IV", "Campus III", "Doha", "Faraón", "Cairo II",
  "Menfis", "Gala", "Academy IV", "Combi Premium", "Táctica", "Olimpiada", "Winner", "Sena",
] as const;

const K1214B_TRACKSUIT = [
  "Heroic", "Winner IV", "Phoenix III", "Championship VIII", "Phoenix II", "Danubio IV",
  "Líder", "Championship VII", "Eco Championship", "Danubio III", "Victory", "Lion II",
  "Danubio II", "Academy IV",
] as const;

const K1214B_RUNNING = [
  "Picasho City", "Record Pro", "Élite XI", "Élite X", "Élite IX", "Record II", "R-Night",
  "R-City", "R-Nature", "Básicos", "Pants & Tights",
] as const;

const K1214B_RUGBY = [
  "Phoenix III", "Myskin III", "Nation", "Stimulus", "Teamwork", "Skrum", "Olimpiada",
  "Strong", "Pants", "Accessories",
] as const;

const K1214B_BASKETBALL = [
  "Phoenix III", "Final Four Set", "Lider Set", "Cancha", "Final II Set", "Atlanta Set",
  "Olimpiada Set", "Kansas Set", "Aro (reversible)", "Combi", "Pants", "Accessories",
] as const;

const K1214B_VOLLEYBALL = [
  "Championship 20", "Championship VIII", "Dinamo", "Academy IV", "Academy III", "Shorts",
  "Accessories",
] as const;

const K1214B_HANDBALL = [
  "Phoenix III", "Dinamo II", "Dinamo", "Hispa V", "Teamwork", "Olimpiada", "Strong",
  "Combi", "Combi Premium", "Pants", "Accessories",
] as const;

const K1214B_RACKET = [
  "Terra", "Montreal 2026", "Montreal 2025", "Challenge", "Smash", "Básicos of armario",
  "Palas of pádel", "Palas of Pickleball", "Accessories",
] as const;

const K1214B_OUTERWEAR = ["Anorak/Jackets", "Chubasqueros/Windbreakers", "Soft Shell/Polar"] as const;
const K1214B_PANTS = ["Pants corto", "Pants largo", "Leggings", "Pants largo cotton"] as const;

const K1214G_TSHIRTS_SET = [
  "Championship 20", "Championship VIII", "Heroic", "Heroic Cotton", "Picasho", "Toletum VII",
  "Líder Set", "Eco championship", "Crew V", "Supernova IV", "Montreal", "Championship VI",
  "Bali III", "Academy III", "Academy IV", "Combi", "Combi premium", "Phoenix set",
] as const;

const K1214G_JACKETS = [
  "Championship 20", "Championship VIII", "Phoenix III", "Winner IV", "Heroic",
  "Vintage Eco Retro", "Championship VI", "Eco Supernova", "Supernova III", "Eco Championship",
  "Crew V", "Winner II", "Montreal", "Academy IV",
] as const;

const K1214G_RUNNING = [
  "Picasho City", "Record pro", "Elite XI", "Elite X", "Elite IX", "Elite VIII", "Record II",
  "Basicos", "R-City", "R-Night", "Pants & Tights", "Accessories",
] as const;

const K1214G_FOOTBALL_TSHIRTS = [
  "Championship 20", "Heroic", "Picasho City", "Toletum VII", "Tiger VIII", "Inter VI",
  "Championship VIII", "Phoenix III Set", "Tiger VII", "Danubio IV", "Lider set", "Toletum VI",
  "Dinamo", "Europa VI", "Inter V", "Victory set", "Danubio III set", "Toletum V", "Tiger VI",
  "Chanpionship VII", "Fit One II", "Inter III", "Gold VII", "Proteam II", "Winner III",
  "Lion II", "Crew V", "Europa V", "Eco Championship", "Eco Supernova", "Tiger V", "Flag III",
  "City II", "Copa II", "Academy IV", "Inter IV", "Inter Classic", "Academy III", "Winner",
  "Combi", "Olimpiada",
] as const;

const K1214G_RUGBY = [
  "Phoenix III", "Myskin III", "Stimulus", "Nation", "Teamwork", "Skrum", "Olimpiada",
  "Strong", "Pants", "Accessories",
] as const;

const K1214G_VOLLEY = [
  "Championship 20", "Championship VIII", "Dinamo", "Supernova IV", "Academy III", "Combi",
  "Academy IV", "Record II", "Pants", "Accessories",
] as const;

const K1214G_BASKETBALL = [
  "Phoenix III", "Final four set", "Líder set", "Cancha", "Final II set", "Atlanta set",
  "Olimpiada set", "Kansas set (reversible)", "Aro (reversible)", "Combi", "Pants", "Accessories",
] as const;

const K1214G_HANDBALL = [
  "Dinamo II", "Dinamo", "Hispa V", "Teamwork", "Olimpiada", "Strong", "Combi",
  "Combi premium", "Phoenix III", "Pants", "Accessories",
] as const;

const K1214G_RACKET = [
  "Terra", "Montreal 2026", "Montreal 2025", "Court", "Olimpiada", "Challenge", "Smash",
  "Torneo", "Basicos", "Tracksuit & Jackets", "Skirts & Pants", "Accessories",
  "Palas of Padel", "Palas pickleball",
] as const;

/** Children top-level age bands from the PDF (parents — first views stay clickable). */
export const KIDS_APPAREL_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "kids-1-4",
    label: "1 - 4 years",
    children: [
      {
        key: "k14-teamwear",
        label: "Teamwear",
        children: [
          { key: "k14-tw-tshirts", label: "T-shirts & set", children: kidsLeaves("k14-tw-tshirts", K14_TSHIRTS_SET) },
          { key: "k14-tw-jackets", label: "Jackets & Sweatshirts", children: kidsLeaves("k14-tw-jackets", K14_JACKETS) },
          { key: "k14-tw-tracksuit", label: "Tracksuit", children: kidsLeaves("k14-tw-tracksuit", K14_TRACKSUIT) },
          { key: "k14-tw-pants", label: "Pants", children: kidsLeaves("k14-tw-pants", ["Pants cortos", "Pants largos"]) },
          { key: "k14-tw-tights", label: "Tights" },
        ],
      },
      {
        key: "k14-outerwear",
        label: "Outerwear",
        children: kidsLeaves("k14-outerwear", ["Chubasqueros", "Anoracks/Jackets"]),
      },
      { key: "k14-tshirts-polos", label: "T-shirts & polos" },
      { key: "k14-tracksuit-set", label: "Tracksuit & set" },
      { key: "k14-sweatshirts-jackets", label: "Sweatshirts & Jackets" },
      {
        key: "k14-pants",
        label: "Pants",
        children: kidsLeaves("k14-pants", ["Pants cortos", "Pants largos", "Pants of Cotton"]),
      },
      { key: "k14-brama", label: "Brama" },
      { key: "k14-accessories", label: "Accessories" },
    ],
    cover: "/brand/hub-kids.png",
  },
  {
    key: "kids-6-10",
    label: "6 - 10 years",
    children: [
      {
        key: "k610-teamwear",
        label: "Teamwear",
        children: [
          { key: "k610-tw-tshirts", label: "T-shirts & set", children: kidsLeaves("k610-tw-tshirts", K610_TSHIRTS_SET) },
          { key: "k610-tw-jackets", label: "Jackets & Sweatshirts", children: kidsLeaves("k610-tw-jackets", K610_JACKETS) },
          { key: "k610-tw-tracksuit", label: "Tracksuit", children: kidsLeaves("k610-tw-tracksuit", K610_TRACKSUIT) },
          { key: "k610-tw-pants", label: "Pants", children: kidsLeaves("k610-tw-pants", ["Shorts", "Long pants"]) },
          { key: "k610-tw-outlet", label: "Outlet" },
        ],
      },
      {
        key: "k610-outerwear",
        label: "Outerwear",
        // Part B 6–10 Outerwear is a product leaf. Catalog SKUs filed in
        // that leaf use item family "Outerwear" (not the 1–4 / 12–14 child names).
        exactFamilies: ["outerwear"],
      },
      { key: "k610-tshirts-polos", label: "T-Shirts & Polos" },
      { key: "k610-jackets-sweatshirts", label: "Jackets & Sweatshirts" },
      { key: "k610-set", label: "Set" },
      { key: "k610-tracksuits", label: "Tracksuits" },
      { key: "k610-brama", label: "Brama" },
      {
        key: "k610-pants-tights",
        label: "Pants & Tights",
        children: kidsLeaves("k610-pants-tights", [
          "Pants corto",
          "Pants largo",
          "Leggings",
          "Pants largo cotton",
          "Outlet",
        ]),
      },
      { key: "k610-beachwear", label: "Beachwear" },
      { key: "k610-accessories", label: "Accessories" },
      { key: "k610-previous-seasons", label: "Previous seasons" },
    ],
    cover: "/brand/hub-kids.png",
  },
  {
    key: "kids-12-14-boy",
    label: "12 - 14 years Boy",
    children: [
      {
        key: "k1214b-teamwear",
        label: "Teamwear",
        children: [
          {
            key: "k1214b-tw-training",
            label: "Training",
            children: [
              { key: "k1214b-tw-training-tshirts", label: "T-shirts & set", children: kidsLeaves("k1214b-tw-training-tshirts", K1214B_TSHIRTS_SET) },
              { key: "k1214b-tw-training-jackets", label: "Jackets & Sweatshirts", children: kidsLeaves("k1214b-tw-training-jackets", K1214B_JACKETS) },
              { key: "k1214b-tw-training-tracksuit", label: "Tracksuit", children: kidsLeaves("k1214b-tw-training-tracksuit", K1214B_TRACKSUIT) },
            ],
          },
          { key: "k1214b-tw-running", label: "Running", children: kidsLeaves("k1214b-tw-running", K1214B_RUNNING) },
          {
            key: "k1214b-tw-football",
            label: "Football / Futsal",
            children: [
              { key: "k1214b-tw-football-tshirts", label: "T-shirts & Set", children: kidsLeaves("k1214b-tw-football-tshirts", K1214B_TSHIRTS_SET) },
              { key: "k1214b-tw-football-pants-corto", label: "Pants corto" },
              { key: "k1214b-tw-football-medias", label: "Medias" },
              { key: "k1214b-tw-football-balls", label: "Balls" },
              { key: "k1214b-tw-football-accessories", label: "Accessories" },
            ],
          },
          {
            key: "k1214b-tw-portero",
            label: "Portero",
            children: kidsLeaves("k1214b-tw-portero", ["Set", "Gloves", "Accessories"]),
          },
          { key: "k1214b-tw-rugby", label: "Rugby", children: kidsLeaves("k1214b-tw-rugby", K1214B_RUGBY) },
          { key: "k1214b-tw-basketball", label: "Basketball", children: kidsLeaves("k1214b-tw-basketball", K1214B_BASKETBALL) },
          { key: "k1214b-tw-volleyball", label: "Volleyball", children: kidsLeaves("k1214b-tw-volleyball", K1214B_VOLLEYBALL) },
          { key: "k1214b-tw-handball", label: "Handball", children: kidsLeaves("k1214b-tw-handball", K1214B_HANDBALL) },
          { key: "k1214b-tw-cricket", label: "Cricket" },
          { key: "k1214b-tw-outerwear", label: "Outerwear", children: kidsLeaves("k1214b-tw-outerwear", K1214B_OUTERWEAR) },
          { key: "k1214b-tw-previous-seasons", label: "Previous seasons" },
        ],
      },
      { key: "k1214b-racket", label: "Racket sports", children: kidsLeaves("k1214b-racket", K1214B_RACKET) },
      { key: "k1214b-outerwear", label: "Outerwear", children: kidsLeaves("k1214b-outerwear", K1214B_OUTERWEAR) },
      { key: "k1214b-beachwear", label: "Beachwear" },
      { key: "k1214b-tshirts-polos", label: "T-shirts & Polos" },
      { key: "k1214b-jackets-sweatshirts", label: "Jackets & Sweatshirts" },
      { key: "k1214b-tracksuits", label: "Tracksuits" },
      { key: "k1214b-pants", label: "Pants", children: kidsLeaves("k1214b-pants", K1214B_PANTS) },
      { key: "k1214b-outlet", label: "Outlet" },
      { key: "k1214b-brama", label: "Brama" },
      { key: "k1214b-accessories", label: "Accessories" },
      { key: "k1214b-outlet-2", label: "Outlet" },
    ],
    cover: "/brand/hub-kids.png",
  },
  {
    key: "kids-12-14-girl",
    label: "12 - 14 years Girl",
    children: [
      {
        key: "k1214g-teamwear",
        label: "Teamwear",
        children: [
          {
            key: "k1214g-tw-training",
            label: "Training",
            children: [
              { key: "k1214g-tw-training-tshirts", label: "T-shirts & Set", children: kidsLeaves("k1214g-tw-training-tshirts", K1214G_TSHIRTS_SET) },
              { key: "k1214g-tw-training-jackets", label: "Jackets, Sweatshirts & tracksuit", children: kidsLeaves("k1214g-tw-training-jackets", K1214G_JACKETS) },
              { key: "k1214g-tw-training-pants", label: "Pants", children: kidsLeaves("k1214g-tw-training-pants", ["Pants cortos", "Pants largos"]) },
              { key: "k1214g-tw-training-tights", label: "Tights" },
              { key: "k1214g-tw-training-skirts", label: "Skirts" },
              { key: "k1214g-tw-training-accessories", label: "Accessories" },
            ],
          },
          { key: "k1214g-tw-running", label: "Running", children: kidsLeaves("k1214g-tw-running", K1214G_RUNNING) },
          {
            key: "k1214g-tw-football",
            label: "Football & Futsal",
            children: [
              { key: "k1214g-tw-football-tshirts", label: "T-shirts", children: kidsLeaves("k1214g-tw-football-tshirts", K1214G_FOOTBALL_TSHIRTS) },
              { key: "k1214g-tw-football-pants", label: "Pants" },
              {
                key: "k1214g-tw-football-accessories",
                label: "Accessories",
                children: kidsLeaves("k1214g-tw-football-accessories", ["Balls", "Accessories of Football"]),
              },
            ],
          },
          { key: "k1214g-tw-rugby", label: "Rugby", children: kidsLeaves("k1214g-tw-rugby", K1214G_RUGBY) },
          { key: "k1214g-tw-volley", label: "Volley", children: kidsLeaves("k1214g-tw-volley", K1214G_VOLLEY) },
          { key: "k1214g-tw-basketball", label: "Basketball", children: kidsLeaves("k1214g-tw-basketball", K1214G_BASKETBALL) },
          { key: "k1214g-tw-handball", label: "Handball", children: kidsLeaves("k1214g-tw-handball", K1214G_HANDBALL) },
          { key: "k1214g-tw-cricket", label: "Cricket" },
          {
            key: "k1214g-tw-portera",
            label: "Portera",
            children: kidsLeaves("k1214g-tw-portera", ["Set", "Gloves", "Accessories"]),
          },
          {
            key: "k1214g-tw-outwear",
            label: "Outwear",
            children: kidsLeaves("k1214g-tw-outwear", ["Chubasqueros", "Jackets"]),
          },
        ],
      },
      { key: "k1214g-racket", label: "Racket sports", children: kidsLeaves("k1214g-racket", K1214G_RACKET) },
      { key: "k1214g-outerwear", label: "Outerwear", children: kidsLeaves("k1214g-outerwear", ["Chubasqueros", "Jacket"]) },
      { key: "k1214g-beachwear", label: "Beachwear", children: kidsLeaves("k1214g-beachwear", ["Beachwear", "Accessories"]) },
      { key: "k1214g-tshirts-polos", label: "T-shirts & Polos" },
      { key: "k1214g-jackets-sweatshirts", label: "Jackets & Sweatshirts" },
      { key: "k1214g-tracksuit-set", label: "Tracksuit & Set" },
      { key: "k1214g-pants-tights", label: "Pants & Tights", children: kidsLeaves("k1214g-pants-tights", ["Pants cortos", "Pants largos", "Casual", "Tights"]) },
      { key: "k1214g-skirts-dresses", label: "Skirts & Dresses" },
      { key: "k1214g-underwear-brama", label: "Underwear & Brama" },
      { key: "k1214g-accessories", label: "Accessories" },
    ],
    cover: "/brand/hub-kids.png",
  },
];

/* ─── Accessories (PDF Accessories — 14 leaves, `acc`-prefixed keys) ─── */

export const ACCESSORIES_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "accessories",
    label: "Accessories",
    children: [
      { key: "acc-balls", label: "Balls", sub: "balls", families: ["balls"], pattern: /\bballs?\b/ },
      { key: "acc-gloves-portero", label: "Gloves portero", sub: "gk-gloves", families: ["gloves", "goalkeeper gloves"], pattern: /\b(glove|goalkeeper)\b/ },
      { key: "acc-backpacks", label: "Backpacks", sub: "bags", families: ["backpack", "backpacks", "bag"], pattern: /\bbackpacks?\b/ },
      { key: "acc-medias", label: "Medias", families: ["medias"], pattern: /\bmedias\b/ },
      { key: "acc-socks", label: "Socks", sub: "socks", families: ["socks"], pattern: /\bsocks\b/ },
      { key: "acc-teamwear", label: "Accessories teamwear", families: ["teamwear accessories"], pattern: /\bteamwear\b.{0,24}\baccessories\b/ },
      { key: "acc-running", label: "Accessories running", sub: "accessories", families: ["running accessories"], pattern: /\brunning\b.{0,24}\baccessories\b/ },
      { key: "acc-racket", label: "Accessories of Racket", families: ["racket", "rackets"], pattern: /\brackets?\b/ },
      { key: "acc-palas-padel", label: "Palas of pádel", families: ["pala", "palas", "padel"], pattern: /\b(palas?|padel)\b/ },
      { key: "acc-palas-pickleball", label: "Palas of Pickleball", families: ["pickleball"], pattern: /\bpickleball\b/ },
      { key: "acc-outdoor", label: "Accessories Outdoor", families: ["outdoor"], pattern: /\boutdoor\b/ },
      { key: "acc-fitness-gym", label: "Accessories Fitness / Gym", families: ["fitness accessories", "gym accessories"], pattern: /\b(fitness|gym)\b.{0,24}\baccessories\b/ },
      { key: "acc-tiendas", label: "Accessories tiendas" },
      { key: "acc-teamwear-catalogue", label: "Teamwear Catalogue" },
    ],
  },
];

/* ─── Outlet (PDF Outlet — 18 leaves, `outlet`-prefixed keys) ─── */

export const OUTLET_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "outlet",
    label: "Outlet",
    children: [
      // Membership is the B2B folder the SKU was filed in (`item` / sheet
      // category), not a catalog-wide name regex and not the offer/new badge
      // (this bake has neither). `patternFamilies: ["outlet"]` only pulls
      // generic Outlet-bucket SKUs into the matching type leaf.
      { key: "outlet-promotions", label: "Promotions", exactFamilies: ["promotions", "outlet"] },
      { key: "outlet-footwear", label: "Footwear", exactFamilies: ["footwear"] },
      { key: "outlet-apparel-byear", label: "Apparel of byear", exactFamilies: ["apparel of byear"] },
      {
        key: "outlet-sweatshirt-jacket",
        label: "Sweatshirt / Jacket",
        exactFamilies: ["sweatshirt / jacket"],
        patternFamilies: ["outlet"],
        pattern: /\b(sweatshirts?|hoodies?|hoodie|fleece|jackets?)\b/,
      },
      {
        key: "outlet-tshirt-top",
        label: "T-shirt / Top",
        exactFamilies: ["t-shirt / top"],
        patternFamilies: ["outlet"],
        pattern: /\b(polos?|t-shirts?|tees?)\b/,
      },
      {
        key: "outlet-pants-shorts",
        label: "Pants / Shorts",
        exactFamilies: ["pants / shorts"],
        patternFamilies: ["outlet"],
        pattern: /\b(pants|shorts|bermuda)\b/,
      },
      {
        key: "outlet-anorak",
        label: "Anorak",
        exactFamilies: ["anorak"],
        patternFamilies: ["outlet"],
        pattern: /\banoraks?\b/,
      },
      {
        key: "outlet-tracksuit",
        label: "Tracksuit",
        exactFamilies: ["tracksuit"],
        patternFamilies: ["outlet"],
        pattern: /\btracksuits?\b/,
      },
      {
        key: "outlet-junior",
        label: "Junior",
        exactFamilies: ["junior"],
        patternFamilies: ["outlet"],
        pattern: /\b(junior|kids)\b/,
      },
      { key: "outlet-price-199-299", label: "1.99 - 2.99", exactFamilies: ["1.99 - 2.99"] },
      { key: "outlet-price-299-399", label: "2.99 - 3.99", exactFamilies: ["2.99 - 3.99"] },
      { key: "outlet-price-399-499", label: "3.99 - 4.99", exactFamilies: ["3.99 - 4.99"] },
      { key: "outlet-price-499-599", label: "4.99 - 5.99", exactFamilies: ["4.99 - 5.99"] },
      { key: "outlet-price-599-699", label: "5.99 - 6.99", exactFamilies: ["5.99 - 6.99"] },
      { key: "outlet-price-699-799", label: "6.99 - 7.99", exactFamilies: ["6.99 - 7.99"] },
      { key: "outlet-price-799-1099", label: "7.99 - 10.99", exactFamilies: ["7.99 - 10.99"] },
      { key: "outlet-price-1099-1599", label: "10.99 - 15.99", exactFamilies: ["10.99 - 15.99"] },
      { key: "outlet-price-from-1599", label: "From 15.99", exactFamilies: ["from 15.99"] },
    ],
  },
];

/* ─── Official Kits (PDF Official Kits — Réplicas, Federations, Special Editions) ───
 * Club leaves match team names in product names; leaves without catalog
 * evidence still render as tiles (empty allowed).
 */

const KITS_REPLICA_CLUBS: readonly JomaFolderDef[] = [
  { key: "kit-getafe", label: "Getafe", families: ["getafe"], pattern: /\bgetafe\b/ },
  { key: "kit-getafe-26-27", label: "Getafe 26/27", families: ["getafe"], pattern: /\bgetafe\b/ },
  { key: "kit-swansea-26-27", label: "Swansea 26/27", families: ["swansea"], pattern: /\bswansea\b/ },
  { key: "kit-norwich-26-27", label: "Norwich 26/27", families: ["norwich"], pattern: /\bnorwich\b/ },
  { key: "kit-villareal", label: "Villareal", families: ["villareal"], pattern: /\bvillareal\b/ },
  { key: "kit-villarreal-26-27", label: "Villarreal 26/27", families: ["villarreal"], pattern: /\bvillarreal\b/ },
  { key: "kit-inter-jp", label: "Inter JP Financial FS", families: ["inter jp"], pattern: /\binter(\s|-)jp\b/ },
  { key: "kit-inter-jp-26-27", label: "Inter JP Financial FS 26/27", families: ["inter jp"], pattern: /\binter(\s|-)jp\b/ },
  { key: "kit-hellas-verona", label: "Hellas Verona", families: ["hellas verona"], pattern: /\bhellas verona\b/ },
  { key: "kit-hellas-25-26", label: "Hellas Verona 25/26", families: ["hellas verona"], pattern: /\bhellas verona\b/ },
  { key: "kit-hellas-26-27", label: "Hellas Verona 26/27", families: ["hellas verona"], pattern: /\bhellas verona\b/ },
  { key: "kit-hoffenheim", label: "Hoffenheim", families: ["hoffenheim"], pattern: /\bhoffenheim\b/ },
  { key: "kit-anderlecht", label: "Anderlecht", families: ["anderlecht"], pattern: /\banderlecht\b/ },
  { key: "kit-unicaja", label: "Unicaja Málaga", families: ["unicaja", "unicaja málaga"], pattern: /\bunicaja\b/ },
  { key: "kit-unicaja-26-27", label: "Unicaja Málaga 26/27", families: ["unicaja"], pattern: /\bunicaja\b/ },
  { key: "kit-torino-outlet", label: "TORINO Outlet", families: ["torino"], pattern: /\btorino\b/ },
  { key: "kit-torino-26-27", label: "Torino 26/27", families: ["torino"], pattern: /\btorino\b/ },
  { key: "kit-pescara-outlet", label: "Pescara Calcio Outlet", families: ["pescara"], pattern: /\bpescara\b/ },
  { key: "kit-pescara-26-27", label: "Pescara Calcio 26/27", families: ["pescara"], pattern: /\bpescara\b/ },
  { key: "kit-leganes", label: "Leganés", families: ["leganes", "leganés"], pattern: /\blegan[eé]s\b/ },
  { key: "kit-joventut", label: "Joventut of Badalona", families: ["joventut", "badalona"], pattern: /\b(joventut|badalona)\b/ },
  { key: "kit-joventut-26-27", label: "Joventut of Badalona 26/27", families: ["joventut"], pattern: /\bjoventut\b/ },
  { key: "kit-brentford-25-26", label: "Brentford 25/26", families: ["brentford"], pattern: /\bbrentford\b/ },
  { key: "kit-brentford-26-27", label: "Brentford 26/27", families: ["brentford"], pattern: /\bbrentford\b/ },
  { key: "kit-munchen-25-26", label: "TSV 1860 Munchen 25/26", families: ["munchen", "tsv 1860 munchen"], pattern: /\b(munchen|münchen)\b/ },
  { key: "kit-munchen-26-27", label: "TSV 1860 Munchen 26/27", families: ["munchen"], pattern: /\b(munchen|münchen)\b/ },
  { key: "kit-murcia-26-27", label: "The Pozo Murcia 26/27", families: ["murcia", "pozo murcia"], pattern: /\bmurcia\b/ },
  { key: "kit-lorient", label: "Lorient", families: ["lorient"], pattern: /\blorient\b/ },
  { key: "kit-lorient-26-27", label: "Lorient 26/27", families: ["lorient"], pattern: /\blorient\b/ },
  { key: "kit-juarez", label: "FC Juarez", families: ["juarez", "juárez"], pattern: /\bju[aá]rez\b/ },
  { key: "kit-juarez-25-26", label: "FC Juarez 25/26", families: ["juarez"], pattern: /\bju[aá]rez\b/ },
  { key: "kit-juarez-26-27", label: "FC Juarez 26/27", families: ["juarez"], pattern: /\bju[aá]rez\b/ },
  { key: "kit-fiorentina-26-27", label: "ACF Fiorentina 26/27", families: ["fiorentina"], pattern: /\bfiorentina\b/ },
  { key: "kit-sociedad-26-27", label: "Real Sociedad 26/27", families: ["sociedad"], pattern: /\bsociedad\b/ },
  { key: "kit-marathon-25-26", label: "Marathon 25/26", families: ["marathon"], pattern: /\bmarathon\b/ },
  { key: "kit-ranchers", label: "Texas Ranchers", families: ["ranchers", "texas ranchers"], pattern: /\branchers\b/ },
  { key: "kit-vegas", label: "The Vegas Lights", families: ["vegas lights", "vegas"], pattern: /\bvegas\b/ },
  { key: "kit-perugia-26-27", label: "Perugia Calcio 26/27", families: ["perugia"], pattern: /\bperugia\b/ },
  { key: "kit-trabzonspor-26-27", label: "Trabzonspor 26/27", families: ["trabzonspor"], pattern: /\btrabzonspor\b/ },
];

const KITS_FEDERATIONS: readonly JomaFolderDef[] = [
  { key: "kit-fed-rfea", label: "R.F.E.A.", pattern: /\br\.?\s?f\.?\s?e\.?\s?a\.?\b|\brfea\b/ },
  { key: "kit-fed-rumania", label: "Fed. Football Rumanía", pattern: /\bruman[ií]a\b/ },
  { key: "kit-fed-rumania-2025", label: "Fed. Football Rumanía 2025", pattern: /\bruman[ií]a\b/ },
  { key: "kit-fed-coe", label: "C.O.E", pattern: /\bcoe\b/ },
  { key: "kit-fed-coe-winter", label: "COE JJOO Invierno", pattern: /\b(jjoo|invierno)\b/ },
  { key: "kit-fed-rugby", label: "Fed. Esp. Rugby", pattern: /\bfed\b.{0,25}\brugby\b|\brugby\b.{0,25}\bfed\b/ },
  { key: "kit-fed-handball", label: "Fed. Esp. Handball", pattern: /\bfed\b.{0,25}\bhandball\b|\bhandball\b.{0,25}\bfed\b/ },
  { key: "kit-fed-honduras", label: "Federation Football Honduras", pattern: /\bhonduras\b/ },
  { key: "kit-fed-sala", label: "Federation of Football Sala of España", pattern: /\bfederation\b/ },
  { key: "kit-fed-fitp", label: "FITP", pattern: /\bfitp\b/ },
  { key: "kit-fed-fidal", label: "FIDAL", pattern: /\bfidal\b/ },
];

const KITS_SPECIAL: readonly JomaFolderDef[] = [
  { key: "kit-sp-ss27", label: "Special Editions SS27", pattern: /\bss27\b/ },
  { key: "kit-sp-football", label: "Football / Futsal" },
  { key: "kit-sp-running", label: "Running" },
  { key: "kit-sp-padel", label: "Pádel" },
  { key: "kit-sp-pickleball", label: "Pickleball" },
  { key: "kit-sp-pedroche", label: "Cristina Pedroche Barefoot", pattern: /\bpedroche\b/ },
  { key: "kit-sp-mundial", label: "Football Retro Mundial 2026", pattern: /\bmundial 2026\b/ },
  { key: "kit-sp-superman", label: "Superman collection", pattern: /\bsuperman\b/ },
  { key: "kit-sp-trail", label: "Team Trail", pattern: /\bteam trail\b/ },
];

/** Official Kits top hub (PDF Official Kits) for the teamwear kits drill-down. */
export const OFFICIAL_KITS_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "official-kits",
    label: "Official Kits",
    children: [
      { key: "kits-replicas", label: "Réplicas of sponsor", children: KITS_REPLICA_CLUBS },
      { key: "kits-federations", label: "Federations and Committees", children: KITS_FEDERATIONS },
      { key: "kits-special", label: "Special Editions", children: KITS_SPECIAL },
    ],
  },
];

const ALL_FOLDERS: JomaFolderDef[] = [];

function indexFolder(folder: JomaFolderDef) {
  ALL_FOLDERS.push(folder);
  for (const child of folder.children ?? []) indexFolder(child);
}

for (const f of FOOTWEAR_FOLDERS) indexFolder(f);
for (const f of KIDS_FOOTWEAR_FOLDERS) indexFolder(f);
for (const f of APPAREL_FOLDERS) indexFolder(f);
for (const f of WOMAN_APPAREL_FOLDERS) indexFolder(f);
for (const f of KIDS_APPAREL_FOLDERS) indexFolder(f);
for (const f of OFFICIAL_KITS_FOLDERS) indexFolder(f);
for (const f of ACCESSORIES_FOLDERS) indexFolder(f);
for (const f of OUTLET_FOLDERS) indexFolder(f);
for (const f of FOOTBALL_SURFACES) indexFolder(f);
for (const f of TEAMWEAR_CHILDREN) indexFolder(f);

const JOMA_FOLDER_BY_KEY = new Map(ALL_FOLDERS.map((f) => [f.key, f]));

const JOMA_FOLDER_PARENT = new Map<string, string>();

function indexParents(folder: JomaFolderDef, parentKey?: string) {
  if (parentKey) JOMA_FOLDER_PARENT.set(folder.key, parentKey);
  for (const child of folder.children ?? []) indexParents(child, folder.key);
}

for (const f of FOOTWEAR_FOLDERS) indexParents(f);
for (const f of KIDS_FOOTWEAR_FOLDERS) indexParents(f);
for (const f of APPAREL_FOLDERS) indexParents(f);
for (const f of WOMAN_APPAREL_FOLDERS) indexParents(f);
for (const f of KIDS_APPAREL_FOLDERS) indexParents(f);
for (const f of OFFICIAL_KITS_FOLDERS) indexParents(f);
for (const f of ACCESSORIES_FOLDERS) indexParents(f);
for (const f of OUTLET_FOLDERS) indexParents(f);

/** All known Joma browse folder keys (for listing filters). */
export function isJomaBrowseFolder(key: string) {
  return JOMA_FOLDER_BY_KEY.has(key);
}

/** True for the Outlet root and its Part B children (`outlet-*`). */
export function isOutletFolderKey(key: string) {
  if (key === "outlet") return true;
  let cur = JOMA_FOLDER_PARENT.get(key);
  while (cur) {
    if (cur === "outlet") return true;
    cur = JOMA_FOLDER_PARENT.get(cur);
  }
  return false;
}

/**
 * Woman footwear omits Part B extras that only exist on the Man shoe tree,
 * plus Outlet. Part B lists Outlet once, under the Footwear root.
 */
const WOMAN_FOOTWEAR_OMIT = new Set([
  "badminton",
  "basketball-shoes",
  "joma-flow",
  "footwear-outlet",
]);

export function footwearFoldersForAudience(audience: string | null | undefined) {
  if (audience === "women") {
    return FOOTWEAR_FOLDERS.filter((folder) => !WOMAN_FOOTWEAR_OMIT.has(folder.key));
  }
  return FOOTWEAR_FOLDERS;
}

/** Immediate parent folder key, if any. */
export function jomaFolderParentKey(key: string) {
  return JOMA_FOLDER_PARENT.get(key);
}

/** Ancestor keys from root → parent (excludes `key` itself). */
export function jomaFolderAncestorKeys(key: string): string[] {
  const chain: string[] = [];
  let cur = JOMA_FOLDER_PARENT.get(key);
  while (cur) {
    chain.unshift(cur);
    cur = JOMA_FOLDER_PARENT.get(cur);
  }
  return chain;
}

/** Sibling folder defs (same parent). Top-level apparel/footwear use their root list. */
export function jomaFolderSiblings(key: string): readonly JomaFolderDef[] {
  const parentKey = JOMA_FOLDER_PARENT.get(key);
  if (!parentKey) {
    if (APPAREL_FOLDERS.some((f) => f.key === key)) return APPAREL_FOLDERS;
    if (WOMAN_APPAREL_FOLDERS.some((f) => f.key === key)) return WOMAN_APPAREL_FOLDERS;
    if (FOOTWEAR_FOLDERS.some((f) => f.key === key)) return FOOTWEAR_FOLDERS;
    if (KIDS_APPAREL_FOLDERS.some((f) => f.key === key)) return KIDS_APPAREL_FOLDERS;
    if (KIDS_FOOTWEAR_FOLDERS.some((f) => f.key === key)) return KIDS_FOOTWEAR_FOLDERS;
    if (ACCESSORIES_FOLDERS.some((f) => f.key === key)) return ACCESSORIES_FOLDERS;
    if (OUTLET_FOLDERS.some((f) => f.key === key)) return OUTLET_FOLDERS;
    if (OFFICIAL_KITS_FOLDERS.some((f) => f.key === key)) return OFFICIAL_KITS_FOLDERS;
    return [];
  }
  return jomaFolderByKey(parentKey)?.children ?? [];
}

/** Root mid-folders for an audience or footwear browse landing. */
export function jomaRootFoldersForAudience(
  audience: "men" | "women" | "kids" | "footwear" | "accessories" | "outlet",
): readonly JomaFolderDef[] {
  if (audience === "kids") return KIDS_APPAREL_FOLDERS;
  if (audience === "footwear") return FOOTWEAR_FOLDERS;
  if (audience === "women") return WOMAN_APPAREL_FOLDERS;
  if (audience === "accessories") return ACCESSORIES_FOLDERS;
  if (audience === "outlet") return OUTLET_FOLDERS;
  return APPAREL_FOLDERS;
}
