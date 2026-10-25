"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/stores/auth";
import { useOrders } from "@/lib/stores/orders";
import type { DeleteAccountForm as Copy } from "./content";

export function DeleteAccountForm({ copy }: { copy: Copy }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "done">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (confirm.trim() !== copy.confirmWord) return;
    setStatus("deleting");
    setError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(res.status === 403 && body.error ? body.error : copy.failed);
        setStatus("idle");
        return;
      }
      useOrders.setState({ orders: [] });
      await logout();
      setStatus("done");
    } catch {
      setError(copy.failed);
      setStatus("idle");
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-tight text-[var(--text-secondary)] sm:text-2xl">
        {copy.heading}
      </h2>
      {status === "done" ? (
        <p role="status" className="mt-3 text-sm leading-7 sm:text-base">
          {copy.done}
        </p>
      ) : !user ? (
        <>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">{copy.signInHint}</p>
          <Button asChild className="mt-4">
            <Link href="/login?next=/account/delete">{copy.signIn}</Link>
          </Button>
        </>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 space-y-4">
          <p className="break-all text-sm text-[var(--muted)]">
            {copy.signedInAs.replace("{email}", user.email)}
          </p>
          <p className="text-sm leading-7 sm:text-base">{copy.warning}</p>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="confirm-delete">{copy.confirmLabel}</Label>
            <Input
              id="confirm-delete"
              className="h-12 text-base sm:h-11 sm:text-sm"
              autoComplete="off"
              autoCapitalize="characters"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={confirm.trim() !== copy.confirmWord || status === "deleting"}
          >
            {status === "deleting" ? copy.deleting : copy.button}
          </Button>
        </form>
      )}
    </section>
  );
}
