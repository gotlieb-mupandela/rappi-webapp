#!/usr/bin/env python3
"""Fill browse folders from the supplier menu tree and crawl.

Each of our leaves is paired with the supplier node at the same menu path
(nav_tree.json). Membership is that node's collection, in crawl order
(master_products_full.jsonl). A product we do not stock is left out.

A product that is browsable on the live catalog (available, imaged, and in
a category at eef7753) and that the crawl does not file anywhere keeps its
previous categories, so it does not disappear from the shop.

Does not read or write prices, stock, or images.
"""
from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from collections import defaultdict

ROOT = "/workspace"
PRODUCTS = f"{ROOT}/data/products.json"
META = f"{ROOT}/data/joma-folder-meta.json"
NAV = f"{ROOT}/data/supplier/nav_tree.json"
CRAWL = f"{ROOT}/data/supplier/master_products_full.jsonl"
OUT_ORDER = f"{ROOT}/data/folder-collection-order.json"
OUT_FOLDERS = f"{ROOT}/data/product-folders.json"
BASELINE = "eef7753"

# Our root key -> supplier title path(s). Shared keys (one folder, two
# audiences) list both trees; the leaf unions those collections.
ROOT_PATHS: dict[str, list[list[str]]] = {
    "teamwear": [["Hombre", "Teamwear"]],
    "teamwear-pro-2026": [["Hombre", "Teamwear Pro 2026"], ["Mujer", "Teamwear Pro 2026"]],
    "running-trail": [["Hombre", "Running / Trailrunning"]],
    "cycling": [["Hombre", "Ciclismo"], ["Mujer", "Ciclismo"]],
    "racket-sports": [["Hombre", "Racket sports"]],
    "hiking-outdoor": [["Hombre", "Senderismo / Outdoor"], ["Mujer", "Senderismo/Outdoor"]],
    "fitness-gym": [["Hombre", "Fitness / Gym"]],
    "lifestyle-apparel": [["Hombre", "Lifestyle"]],
    "aguila-line": [["Hombre", "Línea Águila"], ["Mujer", "Línea Águila"]],
    "resort": [["Hombre", "Resort"], ["Mujer", "Resort"]],
    "beachwear": [["Hombre", "Beachwear"], ["Mujer", "Beachwear"]],
    "underwear-brama": [["Hombre", "Underwear / Brama"]],
    "athletes-combat": [["Hombre", "Athletes / Combat"], ["Mujer", "Athletes / Combat"]],
    "elite-club": [["Hombre", "Elite club"], ["Mujer", "Elite club"]],
    "teamwear-woman": [["Mujer", "Teamwear"]],
    "running-trail-woman": [["Mujer", "Running/Trail"]],
    "racket-sports-woman": [["Mujer", "Racket sports"]],
    "fitness-gym-woman": [["Mujer", "Fitness / Gym"]],
    "lifestyle-apparel-woman": [["Mujer", "Lifestyle"]],
    "underwear-brama-woman": [["Mujer", "Underwear/Brama"]],
    "kids-1-4": [["Niños", "1 - 4 años"]],
    "kids-6-10": [["Niños", "6 - 10 años"]],
    "kids-12-14-boy": [["Niños", "12 - 14 años niño"]],
    "kids-12-14-girl": [["Niños", "12 - 14 años niña"]],
    "official-kits": [["Equipaciones Oficiales"]],
    "accessories": [["Accesorios"]],
    "outlet": [["Outlet"]],
    "special-editions": [
        ["Calzado", "Hombre", "Ediciones especiales"],
        ["Calzado", "Mujer", "Ediciones especiales"],
    ],
    "football-surfaces": [
        ["Calzado", "Hombre", "Fútbol"],
        ["Calzado", "Mujer", "Fútbol"],
    ],
}

# Footwear roots that are one collection per gender, not a folder of surfaces.
SHOE_GENDERS = {
    "men": ["Calzado", "Hombre"],
    "women": ["Calzado", "Mujer"],
    "kids": ["Calzado", "Kids"],
}


def fold(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower().replace("&", " and ").replace("/", " ")
    text = re.sub(r"(?<![a-z])joma(?![a-z])", " ", text)
    text = re.sub(r"[^a-z0-9.+ -]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


PHRASES = [
    ("replicas de sponsor", "sponsor replicas"),
    ("federaciones y comites", "federations and committees"),
    ("ediciones especiales", "special editions"),
    ("temporadas anteriores", "previous seasons"),
    ("cesped artificial", "cesped artificial"),
    ("terreno semiseco y duro", "terreno semiseco and duro"),
    ("sandalias confort", "sandals confort"),
    ("linea aguila", "aguila line"),
    ("palas de padel", "padel rackets"),
    ("palas de pickleball", "pickleball paddles"),
    ("accesorios de raqueta", "accessories of racket"),
    ("guantes portero", "gloves portero"),
    ("entrenamiento polyester", "training polyester"),
    ("entrenamiento cotton", "training cotton"),
    ("sudaderas and chaquetas", "sweatshirts and jackets"),
    ("chaquetas and sudaderas", "jackets and sweatshirts"),
    ("camisetas and polos", "t-shirts and polos"),
    ("chandal and set", "tracksuit and set"),
    ("pantalones and mallas", "pants and tights"),
    ("faldas and vestidos", "skirts and dresses"),
    ("sudadera chaqueta", "sweatshirt jacket"),
    ("camiseta top", "t-shirt top"),
    ("pantalon short", "pants shorts"),
    ("ropa de bano", "swimwear"),
    ("senderismo outdoor", "hiking outdoor"),
    ("running trailrunning", "running trail"),
    ("1 - 4 anos", "1 - 4 years"),
    ("6 - 10 anos", "6 - 10 years"),
    ("12 - 14 anos nino", "12 - 14 years boy"),
    ("12 - 14 anos nina", "12 - 14 years girl"),
    ("baloncesto", "basketball"),
    ("voleibol", "volleyball"),
    ("balonmano", "handball"),
    ("futbol", "football"),
    ("pantalones", "pants"),
    ("natacion", "swimming"),
    ("ciclismo", "cycling"),
    ("entrenamiento", "training"),
    ("accesorios de futbol", "accessories of football"),
    ("accessories de football", "accessories of football"),
    ("pantalones de algodon", "pants of cotton"),
    ("pantalones cortos", "pants cortos"),
    ("pantalones largos", "pants largos"),
    ("pantalon largo cotton", "pants largo cotton"),
    ("pantalon largo", "pants largo"),
    ("joventut de badalona", "joventut of badalona"),
    ("el pozo murcia", "the pozo murcia"),
    ("las vegas lights", "the vegas lights"),
    ("pants de algodon", "pants of cotton"),
    ("camiseta", "t-shirt"),
    ("tenis", "tennis"),
    ("promociones", "promotions"),
    ("calzado", "footwear"),
    ("sujetadores deportivos", "sports bras"),
    ("anorak chaquetas", "anorak jackets"),
    ("anoraks chaquetas", "anoraks jackets"),
    ("anoracks chaquetas", "anoracks jackets"),
    ("chubasqueros cortavientos", "chubasqueros windbreakers"),
    ("pantalon corto", "pants corto"),
    ("camisetas and set", "t-shirts and set"),
    ("nuevas colecciones", "new collections"),
    ("nuevo ss27", "new ss27"),
    ("colecciones anteriores", "previous collections"),
    ("en stock", "in stock"),
    ("accesorios", "accessories"),
    ("mochilas", "backpacks"),
    ("balones", "balls"),
    ("sudaderas", "sweatshirts"),
    ("chaquetas", "jackets"),
    ("chubasqueros", "raincoats"),
    ("cortavientos", "windbreakers"),
    ("guantes", "gloves"),
    ("mallas", "tights"),
    ("chandal", "tracksuit"),
    ("viaje", "travel"),
    ("desde ", "from "),
    ("anos", "years"),
    ("nino", "boy"),
    ("nina", "girl"),
    ("accessories de football", "accessories of football"),
    ("basicos de armario", "wardrobe basics"),
    ("federacion football honduras", "federation football honduras"),
    ("federacion de football sala de espana", "federation of football sala of espana"),
]


def canon(text: str) -> str:
    text = fold(text)
    for src, dst in PHRASES:
        text = text.replace(src, dst)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokens(text: str) -> set[str]:
    out = set()
    for word in canon(text).split():
        if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]
        out.add(word)
    return out


def similar(a: str, b: str) -> float:
    ca, cb = canon(a), canon(b)
    if ca == cb:
        return 1.0
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def showable(product: dict) -> bool:
    if product.get("available") is False:
        return False
    return bool(product.get("imageUrl") or (product.get("images") or [None])[0])


def main() -> None:
    products = json.load(open(PRODUCTS))
    meta = json.load(open(META))
    nav = json.load(open(NAV))
    by_code = {product["code"]: product for product in products}

    children: dict[str, list[str]] = defaultdict(list)
    label: dict[str, str] = {}
    parent: dict[str, str | None] = {}
    has_children: dict[str, bool] = {}
    for row in meta:
        key = row["key"]
        label.setdefault(key, row["label"])
        if key not in parent:
            parent[key] = row["parent"]
        has_children[key] = has_children.get(key, False) or bool(row["hasChildren"])
        if row["parent"] and key not in children[row["parent"]]:
            children[row["parent"]].append(key)

    def supplier_at(path: list[str]) -> dict:
        nodes = nav["roots"]
        node = None
        for title in path:
            node = next(item for item in nodes if item.get("title") == title)
            nodes = node.get("children") or []
        if node is None:
            raise SystemExit(f"missing supplier path {path}")
        return node

    # collection+link -> ordered codes (file order), catalog products only.
    crawl_order: dict[tuple[int, int], list[str]] = defaultdict(list)
    with open(CRAWL) as handle:
        for line in handle:
            row = json.loads(line)
            code = row.get("code")
            if code not in by_code:
                continue
            crawl_order[(int(row["collection"]), int(row["link"]))].append(code)

    # leaf key -> ordered codes
    leaf_lists: dict[str, list[str]] = {}
    mapped_pairs: dict[str, list[tuple[int, int]]] = {}
    weak: list[str] = []
    unmapped_children: list[str] = []

    def take_codes(pairs: list[tuple[int, int]]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for pair in pairs:
            for code in crawl_order.get(pair, []):
                if code in seen:
                    continue
                seen.add(code)
                out.append(code)
        return out

    def pair_of(node: dict) -> tuple[int, int] | None:
        collection = int(node.get("collection") or 0)
        link = int(node.get("link") or 0)
        if not collection:
            return None
        return (collection, link)

    manual = {
        "outlet-apparel-byear": "Ropa de baño",
    }

    def match_children(our_keys: list[str], sup_nodes: list[dict]) -> list[tuple[str, dict | None, float]]:
        used: set[int] = set()
        paired = []
        for key in our_keys:
            best_i = -1
            best_s = 0.0
            for index, node in enumerate(sup_nodes):
                if index in used:
                    continue
                title = node.get("title") or ""
                if manual.get(key) == title:
                    score = 1.0
                else:
                    score = similar(label[key], title)
                if score > best_s:
                    best_s = score
                    best_i = index
            if best_i >= 0 and best_s >= 0.72:
                used.add(best_i)
                paired.append((key, sup_nodes[best_i], best_s))
            else:
                paired.append((key, None, best_s))
        return paired

    def walk(key: str, sup_nodes: list[dict]) -> None:
        """sup_nodes are the supplier nodes this key maps to (usually 1, or 2 genders)."""
        ours = children.get(key, [])
        if not ours:
            pairs = []
            for node in sup_nodes:
                pair = pair_of(node)
                if pair:
                    pairs.append(pair)
            mapped_pairs[key] = pairs
            leaf_lists[key] = take_codes(pairs)
            return

        # Folder. Pair our children with each supplier node's children.
        # A child can collect collections from every gender tree.
        child_nodes: dict[str, list[dict]] = defaultdict(list)
        for node in sup_nodes:
            sup_kids = node.get("children") or []
            if not sup_kids:
                # Supplier files products on this node itself.
                pair = pair_of(node)
                if pair:
                    mapped_pairs.setdefault(key, []).append(pair)
                continue
            for child, match, score in match_children(ours, sup_kids):
                if match is None:
                    unmapped_children.append(f"{key}/{child} ({label[child]})")
                    continue
                if score < 0.99:
                    weak.append(f"{label[child]} ~ {match.get('title')} ({score:.2f}) under {key}")
                child_nodes[child].append(match)
        # Direct products filed on the folder node (age bands are not this).
        direct = take_codes(mapped_pairs.get(key, []))
        if direct:
            leaf_lists[key] = direct
        for child in ours:
            walk(child, child_nodes.get(child, []))

    bound = set(ROOT_PATHS)
    for key, paths in ROOT_PATHS.items():
        walk(key, [supplier_at(path) for path in paths])

    # Remaining roots are footwear. Match them onto Calzado / Hombre|Mujer|Kids.
    shoe_buckets = {
        gender: supplier_at(path).get("children") or []
        for gender, path in SHOE_GENDERS.items()
    }
    our_roots = []
    seen_root = set()
    for row in meta:
        if row["parent"] is None and row["key"] not in seen_root:
            seen_root.add(row["key"])
            our_roots.append(row["key"])
    for key in our_roots:
        if key in bound:
            continue
        gender = "kids" if key.startswith("kids-") else None
        pools = [shoe_buckets["kids"]] if gender == "kids" else [shoe_buckets["men"], shoe_buckets["women"]]
        nodes = []
        for pool in pools:
            match = match_children([key], pool)
            _child, node, score = match[0]
            if node is not None:
                if score < 0.99:
                    weak.append(f"root {label[key]} ~ {node.get('title')} ({score:.2f})")
                nodes.append(node)
            elif gender == "kids" and key == "kids-outlet":
                # Kids footwear outlet is the Calzado outlet list.
                outlet = supplier_at(["Calzado", "Outlet"])
                nodes.append(outlet)
        if not nodes and key == "footwear-outlet":
            nodes.append(supplier_at(["Calzado", "Outlet"]))
        if not nodes:
            unmapped_children.append(f"ROOT {key} ({label[key]})")
            continue
        walk(key, nodes)

    # Products browsable on the live site keep a category when the crawl
    # filed them nowhere we have a leaf for.
    old = json.loads(
        subprocess.check_output(
            ["git", "show", f"{BASELINE}:data/product-folders.json"],
            cwd=ROOT,
        )
    )
    filed: set[str] = set()
    for seq in leaf_lists.values():
        filed.update(seq)
    restored = 0
    for product in products:
        if product["code"] in filed:
            continue
        if not showable(product):
            continue
        old_keys = [key for key in old.get(product["id"], []) if key in label]
        if not old_keys:
            continue
        leaves = [key for key in old_keys if not children.get(key)]
        targets = leaves or old_keys
        for key in targets:
            bucket = leaf_lists.setdefault(key, [])
            if product["code"] not in bucket:
                bucket.append(product["code"])
        filed.add(product["code"])
        restored += 1

    json.dump(
        {key: [list(pair) for pair in pairs] for key, pairs in mapped_pairs.items()},
        open(f"{ROOT}/data/supplier/leaf-map.json", "w"),
        separators=(",", ":"),
    )
    open(f"{ROOT}/data/supplier/leaf-map.json", "a").write("\n")

    json.dump(leaf_lists, open(OUT_ORDER, "w"), separators=(",", ":"))
    open(OUT_ORDER, "a").write("\n")

    code_keys: dict[str, list[str]] = defaultdict(list)
    for key, seq in leaf_lists.items():
        chain: list[str] = []
        cur: str | None = key
        guard: set[str] = set()
        while cur and cur not in guard:
            guard.add(cur)
            chain.append(cur)
            cur = parent.get(cur)
        for code in seq:
            bucket = code_keys[code]
            for item in chain:
                if item not in bucket:
                    bucket.append(item)
    folder_map = {product["id"]: code_keys.get(product["code"], []) for product in products}
    json.dump(folder_map, open(OUT_FOLDERS, "w"), separators=(",", ":"))
    open(OUT_FOLDERS, "a").write("\n")

    # Coverage of live-browsable products.
    live_browsable = 0
    lost = 0
    for product in products:
        old_keys = old.get(product["id"], [])
        if not old_keys or not showable(product):
            continue
        live_browsable += 1
        if not folder_map[product["id"]]:
            lost += 1

    print(json.dumps({
        "leaves_with_lists": sum(1 for seq in leaf_lists.values() if seq),
        "mapped_leaf_keys": len(mapped_pairs),
        "unmapped": unmapped_children[:40],
        "unmapped_n": len(unmapped_children),
        "weak_matches": weak[:30],
        "weak_n": len(weak),
        "restored_browsable": restored,
        "live_browsable": live_browsable,
        "lost_browsable": lost,
        "tw_pants": len(leaf_lists.get("tw-pants", [])),
        "k610_outerwear": len(leaf_lists.get("k610-outerwear", [])),
    }, indent=2))


if __name__ == "__main__":
    main()
