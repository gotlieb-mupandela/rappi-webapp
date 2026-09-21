"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { MobileBuyBar } from "@/components/mobile-buy-bar";
import { ProductGallery } from "@/components/product-gallery";
import { QtyStepper } from "@/components/qty-stepper";
import { AssortmentBadge, AssortmentHint } from "@/components/assortment-label";
import { getAssortment } from "@/lib/assortment";
import { productDescription } from "@/lib/copy";
import { useLocale } from "@/components/locale-provider";
import { currencySymbol } from "@/lib/i18n/currency";
import { hubName, subName } from "@/lib/i18n/labels";
import {
  buyableSizes,
  hasVisibleSizePicker,
  isLowStock,
  isSoldOut,
  pickerSizes,
  sizeDisplayLabel,
  sizeStock,
  stockLabel,
} from "@/lib/product-stock";
import { feedGroupId } from "@/lib/meta/ids";
import { trackMeta } from "@/lib/meta/pixel";
import { useCart } from "@/lib/stores/cart";
import { cn } from "@/lib/utils";

export function ProductDetail({ product }: { product: Product }) {
  const buyable = buyableSizes(product);
  const visible = pickerSizes(product);
  const [size, setSize] = useState(buyable[0]?.size ?? product.sizes[0]?.size ?? "SKU");
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const { t, format, market } = useLocale();
  const selected = product.sizes.find((s) => s.size === size);
  const stock = sizeStock(product, size);
  const soldOut = isSoldOut(product);
  const catName = hubName(product.category, t);
  const title = product.displayName || product.item;
  const assortment = getAssortment(product);
  const details = productDescription(product, { t, market });
  const showPicker = hasVisibleSizePicker(product);
  const unitLabel = sizeDisplayLabel(size, t);
  const symbol = currencySymbol(market);

  useEffect(() => {
    trackMeta("ViewContent", {
      content_ids: [feedGroupId(product.code)],
      content_type: "product_group",
      content_name: product.displayName || product.name,
      content_category: product.category,
      currency: "NAD",
      value: product.unitPrice || product.price,
    });
  }, [product.category, product.code, product.displayName, product.name, product.price, product.unitPrice]);

  function addToBag() {
    if (soldOut || stock <= 0) {
      toast.error(t("product.soldOutPiece"));
      return;
    }
    const result = add(product, size, qty);
    if (result.ok) toast.success(t(result.messageKey, result.values));
    else toast.error(t(result.messageKey, result.values));
  }

  const actions = (
    <>
      <QtyStepper
        value={qty}
        max={Math.max(stock, 1)}
        onChange={setQty}
        className="shrink-0"
      />
      <Button
        size="lg"
        onClick={addToBag}
        disabled={soldOut || stock === 0}
        className="min-w-0 w-full sm:w-auto sm:min-w-48 sm:flex-1"
      >
        {soldOut ? t("product.soldOut") : t("common.addToBag")}
      </Button>
    </>
  );

  return (
    <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
      <div className="min-w-0">
        <ProductGallery product={product} />
      </div>
      <div className="pdp-type min-w-0 max-w-full lg:sticky lg:top-28 lg:pt-2">
        <p className="text-[11px] font-medium uppercase tracking-normal text-[var(--accent)] sm:tracking-[0.14em]">
          {catName}
          <span className="text-ink/25"> / </span>
          {subName(product.subcategory, t)}
        </p>
        <h1 className="mt-4 break-words font-[family-name:var(--font-oswald)] text-3xl uppercase leading-tight tracking-normal text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 font-mono text-[11px] tracking-normal text-[var(--muted-2)]">
          {product.code}
        </p>
        <div className="mt-6">
          <p className="price text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
            {format(product.price)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AssortmentBadge product={product} className="bg-[var(--text)] text-[var(--bg)]" />
            <AssortmentHint product={product} />
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{stockLabel(product, t)}</p>
          {assortment?.isAssortment ? (
            <p className="mt-1 text-[12px] text-[var(--muted-2)]">
              {assortment.preserveSizes
                ? t("product.pack10", { symbol })
                : t("product.packAssortment", { symbol })}
            </p>
          ) : null}
        </div>

        {showPicker ? (
          <div className="mt-8">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-normal text-[var(--muted)]">
              {t("product.size")}
            </p>
            <div className="flex flex-wrap gap-2">
              {visible.map((row) => (
                <button
                  key={row.size}
                  type="button"
                  disabled={row.stock === 0}
                  onClick={() => {
                    setSize(row.size);
                    setQty(1);
                  }}
                  className={cn(
                    "min-h-11 min-w-[2.75rem] rounded-full border px-3 text-[13px] font-medium tracking-normal transition-[border-color,background-color,color] duration-200 sm:min-w-11 sm:px-4 sm:text-sm sm:tracking-wide",
                    size === row.size
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                      : "border-[var(--border-strong)] text-ink hover:border-[var(--text)]",
                    row.stock === 0 && "cursor-not-allowed opacity-35",
                  )}
                >
                  {sizeDisplayLabel(row.size, t)}
                </button>
              ))}
            </div>
            {selected ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {stock === 0
                  ? t("product.soldOutSize")
                  : isLowStock(stock)
                    ? t("product.limited", { stock })
                    : stockLabel(product, t)}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-8 text-sm text-[var(--muted)]">
            {assortment?.packSize === 10
              ? t("product.orderPack10")
              : assortment?.isAssortment
                ? t("product.orderAssortment")
                : /^ONE$/i.test(size)
                  ? t("product.orderOneSize")
                  : t("product.orderSku")}
          </p>
        )}

        <div className="mt-8 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-normal text-[var(--muted)]">
            {t("product.details")}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{details}</p>
        </div>

        <div className="mt-8 hidden gap-3 md:flex md:flex-row md:items-center">{actions}</div>
        <p className="mt-8 hidden max-w-md text-sm leading-7 text-[var(--muted)] md:block">
          {market === "eu" ? t("product.pricedEur") : t("product.pricedNad")}
        </p>
      </div>

      <MobileBuyBar>
        <div className="pdp-type mx-auto flex max-w-[1440px] flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <p className="price text-base font-semibold">{format(product.price)}</p>
            <p className="text-[12px] font-medium text-[var(--muted)]">
              {soldOut ? t("product.soldOut") : unitLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <QtyStepper
              value={qty}
              max={Math.max(stock, 1)}
              onChange={setQty}
              className="h-11 shrink-0 [&_button]:h-11 [&_button]:w-10"
            />
            <Button
              size="lg"
              onClick={addToBag}
              disabled={soldOut || stock === 0}
              className="h-11 min-w-0 flex-1 px-4 normal-case tracking-[normal]"
            >
              {soldOut ? t("product.soldOut") : t("common.addToBag")}
            </Button>
          </div>
        </div>
      </MobileBuyBar>
      <div className="h-32 md:hidden" />
    </div>
  );
}
