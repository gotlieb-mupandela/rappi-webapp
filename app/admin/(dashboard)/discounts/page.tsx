"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDiscountCodeShape, normalizeDiscountCode } from "@/lib/discount";
import { createClient } from "@/lib/supabase/client";

type DiscountCode = {
  id: string;
  code: string;
  savedCode: string;
  rate: number;
  active: boolean;
  used: number;
};

export default function AdminDiscountsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [rate, setRate] = useState("10");

  async function loadUses() {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("discount_use_counts");
    if (error || !data) return;
    const counts = new Map(
      data.map((row) => [String(row.code).toUpperCase(), Number(row.used_count) || 0]),
    );
    setCodes((current) =>
      current.map((row) => ({
        ...row,
        used: counts.get(row.savedCode.toUpperCase()) ?? 0,
      })),
    );
  }

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("discount_codes")
      .select("id, code, rate, active")
      .order("code");
    if (error) toast.error(error.message);
    setCodes(
      (data ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        savedCode: row.code,
        rate: Number(row.rate),
        active: row.active,
        used: 0,
      })),
    );
    setLoading(false);
    void loadUses();
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void loadUses();
    }, 10000);
    function onFocus() {
      void loadUses();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  function parsedRate(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next) || next <= 0 || next > 100) return null;
    return Math.round(next * 100) / 100;
  }

  async function saveRow(row: DiscountCode) {
    const nextCode = normalizeDiscountCode(row.code);
    if (!isDiscountCodeShape(nextCode)) {
      toast.error("Use 2–32 letters, numbers, _ or -.");
      return;
    }
    if (!Number.isFinite(row.rate) || row.rate <= 0 || row.rate > 100) {
      toast.error("Rate must be greater than 0 and at most 100.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("discount_codes")
      .update({
        code: nextCode,
        rate: row.rate,
        active: row.active,
      })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Discount saved");
      void load();
    }
  }

  async function remove(row: DiscountCode) {
    if (!confirm(`Delete discount code ${row.code}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("discount_codes").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const nextCode = normalizeDiscountCode(code);
    const nextRate = parsedRate(rate);
    if (!isDiscountCodeShape(nextCode)) {
      toast.error("Use 2–32 letters, numbers, _ or -.");
      return;
    }
    if (nextRate == null) {
      toast.error("Rate must be greater than 0 and at most 100.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("discount_codes").insert({
      code: nextCode,
      rate: nextRate,
      active: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Discount code created");
      setCode("");
      setRate("10");
      void load();
    }
  }

  if (loading) return <p className="text-[var(--muted)]">Loading…</p>;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        Discounts
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Codes shoppers can enter on checkout before they pay with DPO. The rate is a percent
        off merchandise. Shipping is not discounted. Used counts orders that applied the code,
        including on the order, the invoice, and the customer’s order list. The count refreshes
        while this page is open.
      </p>

      <div className="mt-8 space-y-3">
        {codes.length ? (
          codes.map((row, i) => (
            <div
              key={row.id}
              className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[minmax(0,1fr)_120px_88px_auto_auto]"
            >
              <Input
                value={row.code}
                aria-label={`Code ${row.code}`}
                onChange={(e) => {
                  const next = [...codes];
                  next[i] = { ...row, code: e.target.value };
                  setCodes(next);
                }}
              />
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                aria-label={`Rate for ${row.code}`}
                value={row.rate}
                onChange={(e) => {
                  const next = [...codes];
                  next[i] = { ...row, rate: Number(e.target.value) };
                  setCodes(next);
                }}
              />
              <p className="flex items-center text-sm" aria-live="polite">
                <span className="text-[var(--muted)]">Used</span>
                <span className="ml-2 font-semibold tabular-nums">{row.used}</span>
              </p>
              <label className="inline-flex items-center gap-2 text-xs uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(e) => {
                    const next = [...codes];
                    next[i] = { ...row, active: e.target.checked };
                    setCodes(next);
                  }}
                />
                Active
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void saveRow(codes[i])}>
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => void remove(row)}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No discount codes yet.</p>
        )}
      </div>

      <form
        onSubmit={onCreate}
        className="mt-10 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <h2 className="text-sm font-bold uppercase tracking-wider">Add code</h2>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <label className="space-y-1.5">
            <Label>Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SAVE10"
              autoComplete="off"
              required
            />
          </label>
          <label className="space-y-1.5">
            <Label>Rate (%)</Label>
            <Input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </label>
        </div>
        <Button type="submit">Create</Button>
      </form>
    </div>
  );
}
