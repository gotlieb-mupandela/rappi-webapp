import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductCard } from "@/components/product-card";
import { ProductDetail } from "@/components/product-detail";
import { ProductMoreHeading } from "@/components/product-more-heading";
import { getProduct, productsByCategory } from "@/lib/products";
import { withFullResProductImages } from "@/lib/media";
import { decodeProductCode } from "@/lib/utils";

export const revalidate = 3600;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ code: string[] }>;
}) {
  const { code } = await params;
  const sku = decodeProductCode(code);
  const found = getProduct(sku);
  if (!found || (found as { available?: boolean }).available === false) notFound();
  const product = withFullResProductImages(found);
  const related = productsByCategory(product.category)
    .filter((p) => p.code !== product.code)
    .slice(0, 4);

  return (
    <div className="page-shell py-8">
      <Breadcrumbs
        items={[
          { href: "/", key: "common.home" },
          { href: `/category/${product.category}`, hub: product.category },
          { href: `/shop/${product.category}`, key: "common.products" },
          { label: product.code },
        ]}
      />
      <div className="mt-8">
        <ProductDetail product={product} />
      </div>
      {related.length ? (
        <section className="mt-16 border-t border-[var(--border)] pt-12">
          <ProductMoreHeading hubSlug={product.category} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.code} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
