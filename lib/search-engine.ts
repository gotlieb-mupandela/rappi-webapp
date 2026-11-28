/**
 * Product search that understands shoppers: typos ("shows" -> shoes), plurals, everyday words
 * ("takkies", "t-shirt"), product groups ("shoes" = every kind of footwear) and combinations
 * ("rugby shirts" -> rugby jerseys). When nothing matches every word, it returns the closest
 * products instead of an empty page and says so.
 */
import type { ListingItem } from "@/lib/listing-types";

export type SearchNote = {
  /** The query as understood, when a word was corrected (e.g. "shows" -> "shoes"). */
  corrected?: string;
  /** True when no product matched every word and these are the nearest products. */
  closest?: boolean;
  message?: string;
};

type Concept = {
  /** Product categories (hub slugs) this word stands for. */
  cats?: string[];
  /** Subcategory slugs this word stands for. */
  subs?: string[];
  /** Also match the word in product text (names), e.g. "school" in "W.SCHOOL JR". */
  text?: boolean;
  /** Plural/display form for notes. */
  label: string;
};

const FOOTWEAR_SUBS = [
  "shoes", "running-shoes", "trail-running", "sneakers", "kids-shoes", "barefoot", "sandals", "summer-shoes",
  "comfort-shoes", "tennis-shoes", "padel-shoes", "pickleball-shoes", "volleyball-shoes", "handball-shoes",
  "basketball-shoes", "hockey-shoes", "training-shoes", "outdoor-shoes", "boots", "football-fg", "football-ag",
  "football-sg", "turf", "futsal",
];
const BOOT_SUBS = ["boots", "football-fg", "football-sg", "football-ag", "turf"];
const SHIRT_SUBS = ["tees", "jerseys", "polos", "tops", "sets", "tees-kids"];

const CONCEPTS: Record<string, Concept> = {
  shoe: { subs: FOOTWEAR_SUBS, label: "shoes" },
  boot: { subs: BOOT_SUBS, text: true, label: "boots" },
  shirt: { subs: SHIRT_SUBS, label: "shirts" },
  jersey: { subs: ["jerseys", "tees", "sets"], label: "jerseys" },
  polo: { subs: ["polos"], label: "polos" },
  short: { subs: ["shorts"], label: "shorts" },
  pant: { subs: ["pants", "tracksuits"], label: "pants" },
  tracksuit: { subs: ["tracksuits"], label: "tracksuits" },
  jacket: { subs: ["jackets", "hoodies"], label: "jackets" },
  hoodie: { subs: ["hoodies"], label: "hoodies" },
  sock: { subs: ["socks"], label: "socks" },
  bag: { subs: ["bags"], text: true, label: "bags" },
  ball: { subs: ["balls"], label: "balls" },
  racket: { subs: ["rackets"], label: "rackets" },
  swimwear: { cats: ["swimming"], subs: ["swimwear"], label: "swimwear" },
  legging: { subs: ["leggings", "tights"], label: "leggings" },
  cap: { subs: ["caps"], text: true, label: "caps" },
  glove: { subs: ["gk-gloves"], text: true, label: "gloves" },
  kit: { subs: ["sets", "jerseys"], text: true, label: "kits" },
  rugby: { cats: ["rugby"], text: true, label: "rugby" },
  football: { cats: ["football"], subs: BOOT_SUBS, text: true, label: "football" },
  padel: { cats: ["padel"], subs: ["padel-shoes", "rackets"], text: true, label: "padel" },
  tennis: { subs: ["tennis-shoes"], text: true, label: "tennis" },
  running: { subs: ["running-shoes", "trail-running"], cats: ["running-fitness"], text: true, label: "running" },
  basketball: { cats: ["basketball"], subs: ["basketball-shoes"], text: true, label: "basketball" },
  swim: { cats: ["swimming"], text: true, label: "swimming" },
  school: { subs: ["kids-shoes"], text: true, label: "school" },
  kid: { subs: ["kids-shoes", "tees-kids"], text: true, label: "kids" },
  cricket: { cats: ["cricket"], text: true, label: "cricket" },
  hockey: { cats: ["hockey"], text: true, label: "hockey" },
  hiking: { cats: ["hiking"], subs: ["outdoor-shoes", "trail-running"], text: true, label: "hiking" },
  gym: { subs: ["training-shoes", "leggings", "tights", "bras", "tops"], text: true, label: "gym" },
  goalkeeper: { subs: ["gk-gloves"], text: true, label: "goalkeeper" },
};

/** Words people type for the same thing. */
const ALIASES: Record<string, string> = {
  sneaker: "shoe", trainer: "shoe", takkie: "shoe", tekkie: "shoe", tackie: "shoe", takky: "shoe", tekky: "shoe", tacky: "shoe", takkies: "shoe", tekkies: "shoe", footwear: "shoe", shoes: "shoe",
  cleat: "boot", stud: "boot", soccer: "football", tee: "shirt", tshirt: "shirt", top: "shirt", vest: "shirt",
  jumper: "hoodie", sweater: "hoodie", sweatshirt: "hoodie", trouser: "pant", jogger: "pant", tights: "legging",
  costume: "swimwear", swimsuit: "swimwear", bikini: "swimwear", raquet: "racket", racquet: "racket",
  kids: "kid", child: "kid", children: "kid", junior: "kid", gk: "goalkeeper", keeper: "goalkeeper", run: "running",
  trackie: "tracksuit", tracky: "tracksuit", hat: "cap",
};

/** Common misspellings that a distance check could get wrong. */
const MISSPELT: Record<string, string> = {
  show: "shoe", shows: "shoe", shooe: "shoe", shooes: "shoe", sheo: "shoe", sheos: "shoe", shoos: "shoe", shose: "shoe",
  sneeker: "sneaker", sneekers: "sneaker", snicker: "sneaker", snickers: "sneaker", sneakrs: "sneaker",
  tracksuite: "tracksuit", tracsuit: "tracksuit", trakcsuit: "tracksuit", jersy: "jersey", jursey: "jersey", jearsey: "jersey",
  rugbi: "rugby", rugy: "rugby", ruby: "rugby", footbal: "football", fotball: "football", futball: "football",
  shrt: "shirt", shit: "shirt", shrits: "shirt", shrts: "short", padle: "padel", paddle: "padel", bots: "boot",
};

/** Sport + footwear with no stock: the nearest footwear for that sport. */
const SPORT_FOOTWEAR_FALLBACK: Record<string, { subs: string[]; message: string }> = {
  rugby: { subs: ["football-fg", "football-sg", "boots"], message: "No rugby boots in stock yet. Closest: football boots with studs." },
  cricket: { subs: ["football-fg", "training-shoes", "running-shoes"], message: "No cricket shoes in stock yet. Closest: studded and training shoes." },
  hockey: { subs: ["hockey-shoes", "turf", "football-ag"], message: "Closest: hockey and turf shoes." },
  netball: { subs: ["volleyball-shoes", "handball-shoes", "basketball-shoes"], message: "No netball shoes in stock yet. Closest: indoor court shoes." },
};

const STOP = new Set(["for", "the", "and", "a", "an", "of", "in", "with", "my", "size", "men", "mens", "man", "women", "womens", "woman", "ladies", "lady"]);

export function singular(w: string) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("oes")) return w.slice(0, -1);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

function words(q: string) {
  return q
    .toLowerCase()
    .replace(/t-shirt/g, "tshirt")
    .replace(/[^a-z0-9.\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w && !STOP.has(w));
}

/** Damerau-Levenshtein distance, stopped early once it passes `max`. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

type Index = { vocab: Map<string, number>; byFirst: Map<string, string[]> };
const INDEX = new WeakMap<ListingItem[], Index>();

function indexFor(catalog: ListingItem[], hay: (p: ListingItem) => string): Index {
  const hit = INDEX.get(catalog);
  if (hit) return hit;
  const vocab = new Map<string, number>();
  for (const p of catalog) {
    for (const raw of hay(p).split(/[^a-z0-9]+/)) {
      if (raw.length < 3 || /\d/.test(raw)) continue;
      const w = singular(raw);
      vocab.set(w, (vocab.get(w) ?? 0) + 1);
    }
  }
  for (const k of [...Object.keys(CONCEPTS), ...Object.keys(ALIASES)]) vocab.set(k, (vocab.get(k) ?? 0) + 1000);
  const byFirst = new Map<string, string[]>();
  for (const w of vocab.keys()) {
    const k = w[0]!;
    if (!byFirst.has(k)) byFirst.set(k, []);
    byFirst.get(k)!.push(w);
  }
  const idx = { vocab, byFirst };
  INDEX.set(catalog, idx);
  return idx;
}

/** Fixes a misspelt word using the catalogue's own vocabulary. */
function correct(w: string, idx: Index) {
  if (MISSPELT[w]) return MISSPELT[w]!;
  const s = singular(w);
  if (MISSPELT[s]) return MISSPELT[s]!;
  if (/\d/.test(w) || w.length < 4 || idx.vocab.has(s) || idx.vocab.has(w)) return s;
  const max = s.length <= 5 ? 1 : 2;
  let best = s;
  let bestD = max + 1;
  let bestFreq = 0;
  for (const cand of idx.byFirst.get(s[0]!) ?? []) {
    const freq = idx.vocab.get(cand) ?? 0;
    // Short words only correct to known product words; rare catalogue words are not targets.
    if ((s.length <= 5 && freq < 1000) || freq < 3) continue;
    const dd = distance(s, cand, max);
    if (dd < bestD || (dd === bestD && freq > bestFreq)) {
      best = cand;
      bestD = dd;
      bestFreq = freq;
    }
  }
  return bestD <= max ? best : s;
}

function conceptOf(w: string): [string, Concept] | null {
  const key = ALIASES[w] ?? w;
  const c = CONCEPTS[key];
  return c ? [key, c] : null;
}

function inConcept(p: ListingItem, c: Concept) {
  return Boolean(
    (c.subs && c.subs.includes(p.subcategory)) ||
      (c.cats && (c.cats.includes(p.category) || p.hubs?.some((h) => c.cats!.includes(h)))),
  );
}

function wordIn(text: string, w: string) {
  // Word start match: "boot" matches "boots", not "reboot".
  return new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
}

const stockOf = (p: ListingItem) => p.sizes?.reduce((s, z) => s + Math.max(0, z.stock ?? 0), 0) ?? 0;

export function smartSearch(
  list: ListingItem[],
  query: string,
  hay: (p: ListingItem) => string,
  catalogForIndex: ListingItem[] = list,
): { items: ListingItem[]; note: SearchNote | null } {
  const raw = query.trim().toLowerCase();
  if (!raw) return { items: list, note: null };

  // An exact product code goes straight to that product.
  const byCode = list.filter((p) => p.code.toLowerCase() === raw);
  if (byCode.length) return { items: byCode, note: null };

  const idx = indexFor(catalogForIndex, hay);
  const typed = words(raw);
  if (!typed.length) return { items: [], note: null };
  const fixed = typed.map((w) => correct(w, idx));
  const changed = fixed.some((w, i) => w !== singular(typed[i]!) && w !== typed[i]);
  const terms = fixed.map((w) => ({ w, concept: conceptOf(w) }));

  type Scored = { p: ListingItem; hits: number; score: number };
  const scored: Scored[] = [];
  for (const p of list) {
    const text = hay(p);
    const name = `${p.name} ${p.title} ${p.displayName ?? ""} ${p.code}`.toLowerCase();
    let hits = 0;
    let score = 0;
    for (const { w, concept } of terms) {
      if (concept && inConcept(p, concept[1])) {
        hits += 1;
        score += 3;
        // "school shoes": a shoe that also says SCHOOL in its name ranks above other kids' shoes.
        if (concept[1].text && wordIn(name, w)) score += 2;
      } else if ((!concept || concept[1].text) && wordIn(name, w)) {
        hits += 1;
        score += 2;
      } else if ((!concept || concept[1].text) && w.length >= 4 && wordIn(text, w)) {
        hits += 1;
        score += 1;
      }
    }
    if (hits) {
      if (typed.length > 1 && name.includes(raw)) score += 4;
      scored.push({ p, hits, score });
    }
  }

  const rank = (a: Scored, b: Scored) =>
    b.hits - a.hits || b.score - a.score || Number(stockOf(b.p) > 0) - Number(stockOf(a.p) > 0);
  const all = scored.filter((s) => s.hits === terms.length).sort(rank);
  const correctedText = changed
    ? fixed.map((w) => conceptOf(w)?.[1].label ?? w).join(" ")
    : undefined;

  if (all.length) {
    return { items: mixTypes(all.map((s) => s.p), all), note: correctedText ? { corrected: correctedText } : null };
  }

  // Nothing matches every word: sport + footwear with no stock -> nearest footwear for that sport.
  const footwear = terms.some((t) => t.concept && (t.concept[0] === "shoe" || t.concept[0] === "boot"));
  const sport = terms.map((t) => t.concept?.[0] ?? t.w).find((k) => SPORT_FOOTWEAR_FALLBACK[k]);
  if (footwear && sport) {
    const fb = SPORT_FOOTWEAR_FALLBACK[sport]!;
    const near = list
      .filter((p) => fb.subs.includes(p.subcategory))
      .sort((a, b) => Number(stockOf(b) > 0) - Number(stockOf(a) > 0));
    const sportItems = scored.filter((s) => s.p.category === sport).sort(rank).map((s) => s.p);
    return {
      items: [...near, ...sportItems.filter((p) => !near.includes(p))],
      note: { closest: true, message: fb.message, ...(correctedText ? { corrected: correctedText } : {}) },
    };
  }

  const partial = scored.sort(rank).map((s) => s.p);
  return {
    items: partial,
    note: partial.length
      ? { closest: true, message: `No exact match for "${query.trim()}". Here are the closest products.`, ...(correctedText ? { corrected: correctedText } : {}) }
      : null,
  };
}

/**
 * Broad searches ("shoes") match hundreds of equally good products. Show a mix of product
 * types first (sneakers, running, school, boots...) instead of one long block of one type.
 */
function mixTypes(items: ListingItem[], scored: { p: ListingItem; score: number }[]) {
  const top = scored[0]?.score ?? 0;
  const tied = scored.filter((s) => s.score === top).length;
  if (tied < 40) return items;
  const head = items.slice(0, tied);
  const groups = new Map<string, ListingItem[]>();
  for (const p of head) {
    if (!groups.has(p.subcategory)) groups.set(p.subcategory, []);
    groups.get(p.subcategory)!.push(p);
  }
  const order = [...groups.values()].sort((a, b) => b.length - a.length);
  const mixed: ListingItem[] = [];
  for (let i = 0; mixed.length < head.length; i++) for (const g of order) if (g[i]) mixed.push(g[i]!);
  return [...mixed, ...items.slice(tied)];
}
