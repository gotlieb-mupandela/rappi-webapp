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
  /** Extra regex against family + display + name. */
  pattern?: RegExp;
  /** Storefront subcategory slug when classification maps here. */
  sub?: string;
  /**
   * When set, product.category must equal this hub slug
   * (e.g. Teamwear Pro 2026 sport leaves → `teampro-2026`).
   */
  category?: string;
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

function leafMatchesProduct(
  folder: JomaFolderDef,
  product: Product,
  fam: string,
  blob: string,
): boolean {
  if (folder.category && product.category !== folder.category) return false;
  if (folder.sub && product.subcategory === folder.sub) return true;
  if (familyIn(fam, folder.families)) return true;
  if (folder.pattern?.test(blob)) return true;
  // Category-only leaf (e.g. catch-all under a campaign hub).
  if (folder.category && !folder.families?.length && !folder.pattern && !folder.sub) {
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
    for (const leaf of leaves) {
      if (!leafMatchesProduct(leaf, product, fam, blob)) continue;
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
    families: ["special editions", "special editions ss27", "superman collection", "team trail"],
    pattern: /\b(special edition|superman collection|cristina pedroche|retro mundial)\b/,
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
];

/* ─── Apparel mid folders (PDF Man / Woman) ─── */

function collectionLeaves(
  prefix: string,
  entries: readonly {
    key: string;
    label: string;
    families?: readonly string[];
    pattern?: RegExp;
  }[],
): JomaFolderDef[] {
  return entries.map((e) => ({
    key: `${prefix}-${e.key}`,
    label: e.label,
    families: e.families,
    pattern: e.pattern,
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
  { key: "oasis", label: "Oasis", families: ["oasis", "oasis ii"] },
]);

/* ─── Teamwear Set collections (PDF Man Teamwear → Set) ─── */

const TEAMWEAR_SET_COLLECTIONS: readonly JomaFolderDef[] = [
  { key: "tw-set-new-area", label: "Set New Area", families: ["set new area"], pattern: /\bset new area\b/ },
  { key: "tw-set-phoenix-iii", label: "Set Phoenix III", families: ["set phoenix iii", "phoenix iii set"], pattern: /\b(set phoenix iii|phoenix iii set)\b/ },
  { key: "tw-set-lider", label: "Set Lider", families: ["set lider", "lider set"], pattern: /\b(set lider|lider set)\b/ },
  { key: "tw-set-liga-pro", label: "Set Liga Pro", families: ["set liga pro", "liga pro"], pattern: /\b(set liga pro|liga pro)\b/ },
  { key: "tw-set-victory", label: "Set Victory", families: ["set victory", "victory set"], pattern: /\b(set victory|victory set)\b/ },
  { key: "tw-set-danubio-iii", label: "Set Danubio III", families: ["set danubio iii", "danubio iii set"], pattern: /\b(set danubio iii|danubio iii set)\b/ },
  { key: "tw-set-inter-classic", label: "Set Inter Classic", families: ["set inter classic", "inter classic"], pattern: /\b(set inter classic|inter classic)\b/ },
  { key: "tw-set-phoenix", label: "Set Phoenix", families: ["set phoenix", "phoenix set"], pattern: /\b(set phoenix|phoenix set)\b/ },
];

/* ─── Entrenador children (PDF Man Teamwear → Entrenador) ─── */

const COACH_CHILDREN: readonly JomaFolderDef[] = [
  { key: "coach-pasarela", label: "Pasarela", families: ["pasarela"], pattern: /\bpasarela\b/ },
  { key: "coach-bali-ii", label: "Bali II", families: ["bali ii"], pattern: /\bbali ii\b/ },
  { key: "coach-confort-classic", label: "Confort classic", families: ["confort classic"], pattern: /\bconfort classic\b/ },
  { key: "coach-bali-iii", label: "Bali III", families: ["bali iii"], pattern: /\bbali iii\b/ },
  { key: "coach-hobby", label: "Hobby", families: ["hobby"], pattern: /\bhobby\b/ },
  {
    key: "coach-arbitro",
    label: "Árbitro",
    families: ["arbitro", "referee"],
    // Catch-all preserves the previous flat Entrenador matches (coach/entrenador
    // products without a more specific collection below).
    pattern: /\b(arbitro|árbitro|referee|coach|entrenador)\b/,
  },
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
        label: "Raincoats/Windbreakers",
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
    ],
  },
  {
    key: "tw-set",
    label: "Set",
    children: TEAMWEAR_SET_COLLECTIONS,
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
    pattern: /\b(cap|hat|visor|beanie|glove|socks)\b/,
  },
  {
    key: "tw-basketball",
    label: "Basketball",
    families: [
      "cancha",
      "cancha iii",
      "final four set",
      "atlanta set",
      "kansas set",
      "aro",
    ],
    pattern: /\b(cancha|final four|kansas|atlanta set|basketball)\b/,
  },
  {
    key: "tw-rugby",
    label: "Rugby",
    families: ["myskin iii", "stimulus", "nation", "teamwork", "skrum", "strong", "rugby"],
    pattern: /\b(rugby|myskin|skrum|stimulus|nation|teamwork)\b/,
    cover: "/brand/hub-rugby.png?v=1",
  },
  {
    key: "tw-volleyball",
    label: "Volleyball",
    families: ["volleyball", "volley"],
    pattern: /\bvolley(ball)?\b/,
  },
  {
    key: "tw-handball",
    label: "Handball",
    families: ["handball", "hispa v", "dinamo ii"],
    pattern: /\b(handball|hispa)\b/,
  },
  {
    key: "tw-coach",
    label: "Entrenador",
    children: COACH_CHILDREN,
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

/**
 * Teamwear Pro 2026 sport folders (PDF Man/Woman).
 * Leaves are scoped to `teampro-2026` so they don’t steal regular Teamwear stock.
 */
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
    category: "teampro-2026",
    pattern: /\b(basketball|basket|cancha|final four)\b/,
  },
  {
    key: "tp-running",
    label: "Running",
    category: "teampro-2026",
    pattern: /\b(running|trail)\b/,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "tp-rugby",
    label: "Rugby",
    category: "teampro-2026",
    pattern: /\b(rugby|myskin|skrum)\b/,
    cover: "/brand/hub-rugby.png?v=1",
  },
  {
    key: "tp-handball",
    label: "Handball",
    category: "teampro-2026",
    pattern: /\b(handball|hispa)\b/,
  },
  {
    key: "tp-volleyball",
    label: "Volleyball",
    category: "teampro-2026",
    pattern: /\bvolley(ball)?\b/,
  },
  {
    key: "tp-training",
    label: "Training",
    category: "teampro-2026",
    pattern: /\b(training|entrenamiento|polyester|cotton|combi)\b/,
    cover: "/brand/hub-teampro-2026.png",
  },
  {
    key: "tp-travel",
    label: "Travel",
    category: "teampro-2026",
    pattern: /\b(travel|pasarela|lifestyle)\b/,
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
      { key: "oasis", label: "Oasis / Desert", families: ["oasis", "oasis ii", "desert"] },
    ]),
  },
];

/** Underwear / Brama (PDF). */
const BRAMA_CHILDREN: readonly JomaFolderDef[] = [
  {
    key: "brama-line",
    label: "Brama Line",
    families: ["brama", "brama line"],
    pattern: /\bbrama\b/,
  },
  {
    key: "brama-sujetadores",
    label: "Sujetadores deportivos",
    families: ["sujetadores deportivos", "sujetador"],
    pattern: /\bsujetador/,
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

/** Children top-level age bands from the PDF. */
export const KIDS_APPAREL_FOLDERS: readonly JomaFolderDef[] = [
  {
    key: "kids-1-4",
    label: "1 - 4 years",
    families: ["baby"],
    pattern: /\b(baby|1\s*-\s*4|infant)\b/,
    cover: "/brand/hub-kids.png",
  },
  {
    key: "kids-6-10",
    label: "6 - 10 years",
    pattern: /\b(6\s*-\s*10|junior|kids|child)\b/,
    cover: "/brand/hub-kids.png",
  },
  {
    key: "kids-12-14-boy",
    label: "12 - 14 years Boy",
    pattern: /\b(12\s*-\s*14|junior|boy)\b/,
    cover: "/brand/hub-kids.png",
  },
  {
    key: "kids-12-14-girl",
    label: "12 - 14 years Girl",
    pattern: /\b(12\s*-\s*14|junior|girl)\b/,
    cover: "/brand/hub-kids.png",
  },
];

/* ─── Official Kits (PDF Official Kits — Réplicas, Federations, Special Editions) ───
 * Club leaves match team names in product names; leaves without catalog
 * evidence still render as tiles (empty allowed).
 */

const KITS_REPLICA_CLUBS: readonly JomaFolderDef[] = [
  { key: "kit-getafe", label: "Getafe", families: ["getafe"], pattern: /\bgetafe\b/ },
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
  { key: "kit-fed-sala", label: "Federation Football Sala", pattern: /\bfederation\b/ },
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
for (const f of KIDS_APPAREL_FOLDERS) indexFolder(f);
for (const f of OFFICIAL_KITS_FOLDERS) indexFolder(f);
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
for (const f of KIDS_APPAREL_FOLDERS) indexParents(f);
for (const f of OFFICIAL_KITS_FOLDERS) indexParents(f);

/** All known Joma browse folder keys (for listing filters). */
export function isJomaBrowseFolder(key: string) {
  return JOMA_FOLDER_BY_KEY.has(key);
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
    if (FOOTWEAR_FOLDERS.some((f) => f.key === key)) return FOOTWEAR_FOLDERS;
    if (KIDS_APPAREL_FOLDERS.some((f) => f.key === key)) return KIDS_APPAREL_FOLDERS;
    if (KIDS_FOOTWEAR_FOLDERS.some((f) => f.key === key)) return KIDS_FOOTWEAR_FOLDERS;
    return [];
  }
  return jomaFolderByKey(parentKey)?.children ?? [];
}

/** Root mid-folders for an audience or footwear browse landing. */
export function jomaRootFoldersForAudience(
  audience: "men" | "women" | "kids" | "footwear",
): readonly JomaFolderDef[] {
  if (audience === "kids") return KIDS_APPAREL_FOLDERS;
  if (audience === "footwear") return FOOTWEAR_FOLDERS;
  return APPAREL_FOLDERS;
}
