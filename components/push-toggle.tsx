"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { isNativeApp, nativePlatform } from "@/lib/native";

export function PushToggle() {
  const t = useT();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled || !isNativeApp()) return;
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { receive } = await PushNotifications.checkPermissions();
        if (!cancelled) {
          setSupported(true);
          setEnabled(receive === "granted");
        }
      } catch {
        if (!cancelled) setSupported(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribeNative() {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const platform = nativePlatform() ?? "ios";
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      setMessage(t("notify.denied"));
      return;
    }
    await PushNotifications.register();
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("token-timeout")), 15000);
      void PushNotifications.addListener("registration", async ({ value }) => {
        window.clearTimeout(timeout);
        try {
          const res = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: value,
              platform,
              userAgent: navigator.userAgent,
            }),
          });
          if (!res.ok) throw new Error("subscribe-failed");
          setEnabled(true);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      void PushNotifications.addListener("registrationError", (err) => {
        window.clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async function unsubscribeNative() {
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" } });
    setEnabled(false);
  }

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      if (enabled) await unsubscribeNative();
      else await subscribeNative();
    } catch {
      setMessage(t("notify.error"));
    } finally {
      setBusy(false);
    }
  }

  const status = enabled ? t("notify.enabled") : t("notify.disabled");
  const detail = supported ? t("notify.body") : t("notify.unsupported");

  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t("notify.title")}</p>
          <p className="mt-0.5 text-sm leading-5 text-[var(--muted)]">{detail}</p>
        </div>
        <p className="shrink-0 text-sm text-[var(--muted)]">{status}</p>
      </div>
      {supported ? (
        <Button size="sm" className="mt-3" disabled={busy} onClick={() => void toggle()}>
          {enabled ? t("notify.disable") : t("notify.enable")}
        </Button>
      ) : null}
      {message ? <p className="mt-2 text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
