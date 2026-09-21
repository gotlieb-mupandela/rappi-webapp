"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { safeProductCode } from "@/lib/utils";

type SizeRow = { id?: string; size: string; stock: number };
type Category = { slug: string; name: string };

const GENDERS = ["men", "women", "kids", "unisex"] as const;

export function ProductEditor({ productId }: { productId: string | null }) {
  const router = useRouter();
  const isNew = !productId || productId === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [code, setCode] = useState("");
  const [item, setItem] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [categorySlug, setCategorySlug] = useState("sportswear");
  const [subcategory, setSubcategory] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("unisex");
  const [price, setPrice] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [badge, setBadge] = useState<"" | "new" | "offer">("");
  const [imageUrl, setImageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [sizes, setSizes] = useState<SizeRow[]>([{ size: "ONE", stock: 0 }]);
  const [id, setId] = useState(productId && productId !== "new" ? productId : "");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("categories")
      .select("slug, name")
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));

    if (isNew) {
      setLoading(false);
      return;
    }

    void (async () => {
      const [{ data: product }, { data: sizeRows }] = await Promise.all([
        supabase.from("products").select("*").eq("id", productId!).single(),
        supabase.from("product_sizes").select("id, size, stock").eq("product_id", productId!),
      ]);
      if (!product) {
        toast.error("Product not found");
        router.push("/admin/products");
        return;
      }
      setId(product.id);
      setCode(product.code);
      setItem(product.item);
      setTitle(product.title);
      setName(product.name);
      setDisplayName(product.display_name);
      setCategorySlug(product.category_slug);
      setSubcategory(product.subcategory);
      setGender(product.gender);
      setPrice(String(product.price));
      setUnitPrice(String(product.unit_price));
      setBadge((product.badge as "" | "new" | "offer") ?? "");
      setImageUrl(product.image_url);
      setImages(product.images ?? []);
      setSizes(
        sizeRows?.length
          ? sizeRows.map((s) => ({ id: s.id, size: s.size, stock: s.stock }))
          : [{ size: "ONE", stock: 0 }],
      );
      setLoading(false);
    })();
  }, [isNew, productId, router]);

  function syncNamesFromCode() {
    const c = code.trim();
    const i = item.trim() || "PRODUCT";
    if (!title) setTitle(`${i} · ${c}`);
    if (!name) setName(`${i} · ${c}`);
    if (!displayName) setDisplayName(i);
    if (!id && c) setId(safeProductCode(c));
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    const safe = safeProductCode(code || id || "upload");
    const uploaded: string[] = [...images];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i];
      const idx = String(uploaded.length + 1).padStart(2, "0");
      const path = `${safe}/${idx}.webp`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true, contentType: file.type || "image/webp" });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    setImages(uploaded.slice(0, 5));
    if (!imageUrl && uploaded[0]) setImageUrl(uploaded[0]);
    toast.success("Images uploaded");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    syncNamesFromCode();
    const supabase = createClient();
    const productIdFinal = (id || safeProductCode(code)).trim();
    const payload = {
      id: productIdFinal,
      code: code.trim(),
      item: item.trim(),
      title: title.trim() || `${item.trim()} · ${code.trim()}`,
      name: name.trim() || `${item.trim()} · ${code.trim()}`,
      display_name: displayName.trim() || item.trim(),
      category_slug: categorySlug,
      subcategory: subcategory.trim() || "general",
      gender,
      price: Number(price),
      unit_price: Number(unitPrice || price),
      currency: "NAD",
      badge: badge || null,
      image_url: imageUrl || "/brand/rappi-logo-v2.png",
      images: images.length ? images : imageUrl ? [imageUrl] : [],
    };

    const { error } = await supabase.from("products").upsert(payload);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Replace sizes
    await supabase.from("product_sizes").delete().eq("product_id", productIdFinal);
    const sizePayload = sizes
      .filter((s) => s.size.trim())
      .map((s) => ({
        product_id: productIdFinal,
        size: s.size.trim(),
        stock: Math.max(0, Number(s.stock) || 0),
      }));
    if (sizePayload.length) {
      const { error: sizeError } = await supabase.from("product_sizes").insert(sizePayload);
      if (sizeError) {
        toast.error(sizeError.message);
        setSaving(false);
        return;
      }
    }

    toast.success("Product saved");
    setSaving(false);
    router.push(`/admin/products/${productIdFinal}`);
    router.refresh();
  }

  async function onDelete() {
    if (!id || isNew) return;
    if (!confirm(`Delete ${code}? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    router.push("/admin/products");
    router.refresh();
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/products"
            className="text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
          >
            ← Products
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-3xl uppercase">
            {isNew ? "New product" : code}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew ? (
            <Button type="button" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
        <Field label="Code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={syncNamesFromCode}
            required
          />
        </Field>
        <Field label="ID (storage key)">
          <Input value={id} onChange={(e) => setId(e.target.value)} required disabled={!isNew} />
        </Field>
        <Field label="Item">
          <Input value={item} onChange={(e) => setItem(e.target.value)} required />
        </Field>
        <Field label="Display name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category">
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subcategory slug">
          <Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} required />
        </Field>
        <Field label="Gender">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as (typeof GENDERS)[number])}
            className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm"
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Badge">
          <select
            value={badge}
            onChange={(e) => setBadge(e.target.value as "" | "new" | "offer")}
            className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm"
          >
            <option value="">None</option>
            <option value="new">New</option>
            <option value="offer">Offer</option>
          </select>
        </Field>
        <Field label="Price (N$)">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </Field>
        <Field label="Unit price (N$)">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </Field>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">Sizes & stock</h2>
        <div className="mt-4 space-y-2">
          {sizes.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Input
                className="max-w-[140px]"
                value={row.size}
                onChange={(e) => {
                  const next = [...sizes];
                  next[i] = { ...row, size: e.target.value };
                  setSizes(next);
                }}
                placeholder="Size"
              />
              <Input
                className="max-w-[120px]"
                type="number"
                min={0}
                value={row.stock}
                onChange={(e) => {
                  const next = [...sizes];
                  next[i] = { ...row, stock: Number(e.target.value) };
                  setSizes(next);
                }}
                placeholder="Stock"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSizes(sizes.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => setSizes([...sizes, { size: "", stock: 0 }])}
        >
          Add size
        </Button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">Images</h2>
        <Field label="Primary image URL" className="mt-4">
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        </Field>
        <div className="mt-4">
          <Label>Upload to product-images (webp preferred)</Label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="mt-2 block w-full text-sm"
            onChange={(e) => void onUpload(e.target.files)}
          />
        </div>
        {images.length ? (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="aspect-square rounded-lg object-cover bg-[var(--bg-elevated)]"
              />
            ))}
          </div>
        ) : null}
      </section>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </label>
  );
}
