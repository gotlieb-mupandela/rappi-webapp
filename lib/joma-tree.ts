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
  if (folder.sub && product.subcategory === folder.sub) return true;
  if (familyIn(fam, folder.families)) return true;
  if (folder.pattern?.test(blob)) return true;
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
  entries: readonly { key: string; label: string; families: readonly string[] }[],
): JomaFolderDef[] {
  return entries.map((e) => ({
    key: `${prefix}-${e.key}`,
    label: e.label,
    families: e.families,
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
    pattern: /\b(football|futsal|toletum|tiger|inter |europa|dinamo|proteam|fit one|gold vii|flag iii|pisa)\b/,
    families: ["football", "futsal", "inter vi", "tiger viii", "toletum vii", "dinamo"],
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
    families: ["entrenador", "pasarela", "arbitro", "árbitro"],
    pattern: /\b(entrenador|coach|arbitro|referee)\b/,
  },
  {
    key: "tw-keeper",
    label: "Portero",
    families: ["portero", "portera", "gloves"],
    pattern: /\b(portero|portera|goalkeeper)\b/,
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
    families: ["teamwear pro 2026", "montreal 2026", "mundial 2026"],
    pattern: /\b(teamwear pro|mundial 2026|montreal 2026|teampro)\b/,
    cover: "/brand/hub-teampro-2026.png",
  },
  {
    key: "running-trail",
    label: "Running / Trail",
    families: [
      "r-city",
      "r-trail",
      "r-night",
      "r-nature",
      "record pro",
      "record ii",
      "elite xi",
      "elite x",
      "elite ix",
      "elite vii & viii",
      "picasho city",
      "basicos",
      "básicos",
    ],
    pattern: /\b(r-city|r-trail|r-night|r-nature|record pro|elite x|running \/ trail)\b/,
    cover: "/brand/hub-shoes.png",
  },
  {
    key: "cycling",
    label: "Cycling",
    families: ["cycling", "spring summer 2027", "fall winter 2026"],
    pattern: /\b(cycling|bike|bicicleta)\b/,
  },
  {
    key: "racket-sports",
    label: "Racket sports",
    families: [
      "challenge",
      "smash",
      "torneo",
      "terra",
      "montreal 26",
      "montreal 25",
      "montreal 2026",
      "montreal 2025",
      "court",
      "basicos",
      "básicos",
    ],
    pattern: /\b(challenge|smash|torneo|terra|padel|p[aá]del|pickleball|tennis)\b/,
  },
  {
    key: "hiking-outdoor",
    label: "Hiking / Outdoor",
    families: ["explorer", "snow", "outdoor"],
    pattern: /\b(explorer|hiking|trekking|outdoor|snow)\b/,
  },
  {
    key: "fitness-gym",
    label: "Fitness / Gym",
    families: ["fitness / gym", "soft", "indoor gym", "indoor", "r-indoor"],
    pattern: /\b(fitness|gym|indoor gym|r-indoor)\b/,
  },
  {
    key: "lifestyle-apparel",
    label: "Lifestyle",
    families: ["mimetic", "step", "urban aesthetics", "urban aesthetics"],
    pattern: /\b(mimetic|urban aesthetics|\bstep\b)\b/,
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
    families: ["brama", "brama line", "intimi", "sujetadores deportivos"],
    pattern: /\b(brama|intimi|sujetador)\b/,
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

const ALL_FOLDERS: JomaFolderDef[] = [];

function indexFolder(folder: JomaFolderDef) {
  ALL_FOLDERS.push(folder);
  for (const child of folder.children ?? []) indexFolder(child);
}

for (const f of FOOTWEAR_FOLDERS) indexFolder(f);
for (const f of KIDS_FOOTWEAR_FOLDERS) indexFolder(f);
for (const f of APPAREL_FOLDERS) indexFolder(f);
for (const f of KIDS_APPAREL_FOLDERS) indexFolder(f);
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
