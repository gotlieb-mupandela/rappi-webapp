#!/usr/bin/env python3
"""Compare baked leaves to the supplier crawl, in menu order.

A leaf matches when its showable products (available, with an image) equal
the mapped collection's stocked showable products in crawl order. Parents
are not scored: the shop concatenates children.

Exit 0 when no live-browsable product is left without a category and the
leaf table is unchanged from the locked digest.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from collections import defaultdict

ROOT = "/workspace"
PRODUCTS = f"{ROOT}/data/products.json"
ORDER = f"{ROOT}/data/folder-collection-order.json"
MAP = f"{ROOT}/data/supplier/leaf-map.json"
CRAWL = f"{ROOT}/data/supplier/master_products_full.jsonl"
META = f"{ROOT}/data/joma-folder-meta.json"
BASELINE = "eef7753"


def showable(product: dict | None) -> bool:
    return bool(
        product
        and product.get("available") is not False
        and (product.get("imageUrl") or (product.get("images") or [None])[0])
    )


def kendall(pred: list[str], target: list[str]) -> float | None:
    wanted = set(target)
    common = [code for code in target if code in set(pred)]
    if len(common) < 2:
        return None
    rank = {code: index for index, code in enumerate(code for code in pred if code in wanted)}
    agree = disagree = 0
    for i, left in enumerate(common):
        for right in common[i + 1 :]:
            if rank[left] < rank[right]:
                agree += 1
            elif rank[left] > rank[right]:
                disagree += 1
    total = agree + disagree
    if not total:
        return None
    return (agree - disagree) / total


def main() -> None:
    products = json.load(open(PRODUCTS))
    by_code = {product["code"]: product for product in products}
    order = json.load(open(ORDER))
    leaf_map = json.load(open(MAP))
    meta = json.load(open(META))
    children = defaultdict(list)
    for row in meta:
        if row["parent"] and row["key"] not in children[row["parent"]]:
            children[row["parent"]].append(row["key"])
    old = json.loads(
        subprocess.check_output(
            ["git", "show", f"{BASELINE}:data/product-folders.json"],
            cwd=ROOT,
        )
    )
    folders = json.load(open(f"{ROOT}/data/product-folders.json"))

    crawl = defaultdict(list)
    with open(CRAWL) as handle:
        for line in handle:
            row = json.loads(line)
            if row["code"] not in by_code:
                continue
            crawl[(str(row["collection"]), str(row["link"]))].append(row["code"])

    def target_of(key: str) -> list[str]:
        out = []
        seen = set()
        for coll, link in leaf_map.get(key, []):
            for code in crawl.get((str(coll), str(link)), []):
                if code in seen or not showable(by_code[code]):
                    continue
                seen.add(code)
                out.append(code)
        return out

    def pred_of(key: str) -> list[str]:
        return [code for code in order.get(key, []) if showable(by_code.get(code))]

    both = sets = orders = missing_leaves = extra_leaves = 0
    missing_slots = extra_slots = 0
    taus = []
    scored = 0
    for key, pairs in leaf_map.items():
        if children.get(key) or not pairs:
            continue
        target = target_of(key)
        pred = pred_of(key)
        if not target and not pred:
            continue
        scored += 1
        if pred == target:
            both += 1
        if set(pred) == set(target):
            sets += 1
        shared = [code for code in target if code in set(pred)]
        pred_shared = [code for code in pred if code in set(target)]
        if shared and pred_shared == shared:
            orders += 1
        miss = set(target) - set(pred)
        extra = set(pred) - set(target)
        if miss:
            missing_leaves += 1
            missing_slots += len(miss)
        if extra:
            extra_leaves += 1
            extra_slots += len(extra)
        tau = kendall(pred, target)
        if tau is not None:
            taus.append(tau)

    live = lost = 0
    for product in products:
        if not old.get(product["id"]) or not showable(product):
            continue
        live += 1
        if not folders.get(product["id"]):
            lost += 1

    brand = 0
    import re
    pat = re.compile(r"(?<![A-Za-z])joma(?![A-Za-z])", re.I)
    for product in products:
        if pat.search(product.get("displayName") or ""):
            brand += 1

    taus.sort()
    median = taus[len(taus) // 2] if taus else None
    report = {
        "scored_leaves": scored,
        "identical_set_and_order": both,
        "identical_product_set": sets,
        "identical_order": orders,
        "leaves_missing": missing_leaves,
        "missing_slots": missing_slots,
        "leaves_extra": extra_leaves,
        "extra_slots": extra_slots,
        "median_kendall": None if median is None else round(median, 3),
        "live_browsable": live,
        "lost_browsable": lost,
        "display_names_with_brand": brand,
        "tw_pants_showable": len(pred_of("tw-pants")),
        "k610_outerwear_showable": len(pred_of("k610-outerwear")),
        "examples": {
            "TOJS2601FG": [key for key, seq in order.items() if "TOJS2601FG" in seq][:4],
            "EVJS2602FG": [key for key, seq in order.items() if "EVJS2602FG" in seq][:4],
        },
    }
    blob = json.dumps(report, sort_keys=True)
    report["digest"] = hashlib.sha256(blob.encode()).hexdigest()[:16]
    print(json.dumps(report, indent=2))
    if lost or brand or both != sets or sets < scored - 15:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
