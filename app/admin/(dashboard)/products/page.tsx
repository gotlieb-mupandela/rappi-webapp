import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Products · Admin" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, code, item, name, category_slug, price, stock_qty, badge, image_url")
    .order("code");

  if (sp.q?.trim()) {
    const q = sp.q.trim();
    query = query.or(`code.ilike.%${q}%,item.ilike.%${q}%,name.ilike.%${q}%`);
  }
  if (sp.low === "1") {
    query = query.gt("stock_qty", 0).lt("stock_qty", 5);
  }
  if (sp.cat) {
    query = query.eq("category_slug", sp.cat);
  }

  const [{ data: products }, { data: categories }] = await Promise.all([
    query.limit(500),
    supabase.from("categories").select("slug, name").order("sort_order"),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
            Products
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {(products ?? []).length} shown · edit stock, prices, and images
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">New product</Link>
        </Button>
      </div>

      <form className="mt-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search code or title"
          className="h-10 min-w-[200px] flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm"
        />
        <select
          name="cat"
          defaultValue={sp.cat ?? ""}
          className="h-10 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-xs uppercase tracking-wider">
          <input type="checkbox" name="low" value="1" defaultChecked={sp.low === "1"} />
          Low stock
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="mt-6 max-h-[calc(100dvh-14rem)] overflow-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Badge</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--hover)]">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="flex items-center gap-3 hover:text-[var(--accent)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url || "/brand/rappi-logo-v2.png"}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover bg-[var(--bg-elevated)]"
                    />
                    <span>
                      <span className="block font-mono font-bold">{p.code}</span>
                      <span className="block text-xs text-[var(--muted)]">{p.item}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 uppercase tracking-wider text-xs">
                  {p.category_slug}
                </td>
                <td className="px-4 py-3">{formatPrice(Number(p.price))}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      p.stock_qty > 0 && p.stock_qty < 5
                        ? "text-[var(--warn)]"
                        : p.stock_qty === 0
                          ? "text-[var(--danger)]"
                          : ""
                    }
                  >
                    {p.stock_qty}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.badge ? (
                    <Badge variant={p.badge === "offer" ? "offer" : "new"}>
                      {p.badge}
                    </Badge>
                  ) : (
                    <span className="text-[var(--muted-2)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
