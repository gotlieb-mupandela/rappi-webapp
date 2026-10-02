import webpush from "web-push";
import type { Database } from "@/lib/database.types";
import { isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { createAdminClient } from "@/lib/supabase/admin";

type PushRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];

const STATUS_COPY: Record<"en" | "fr", Record<OrderStatus, string>> = {
  en: {
    reserved: "reserved",
    preparing: "being prepared",
    shipped: "shipped",
    cancelled: "cancelled",
  },
  fr: {
    reserved: "réservée",
    preparing: "en préparation",
    shipped: "expédiée",
    cancelled: "annulée",
  },
};

function localeForCountry(country: string): "en" | "fr" {
  const value = country.trim().toLowerCase();
  if (
    value === "fr" ||
    value === "france" ||
    value === "be" ||
    value === "belgium" ||
    value === "lu" ||
    value === "luxembourg" ||
    value === "ch" ||
    value === "switzerland" ||
    value.startsWith("fr")
  ) {
    return "fr";
  }
  return "en";
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:sales@rappisportshub.com";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function orderPushPayload(input: {
  orderId: string;
  status: string;
  country?: string | null;
}) {
  const locale = localeForCountry(input.country ?? "");
  const status = isOrderStatus(input.status) ? input.status : "reserved";
  const statusLabel = STATUS_COPY[locale][status];
  const title =
    locale === "fr" ? `Commande RAPPI ${input.orderId}` : `RAPPI order ${input.orderId}`;
  const body =
    locale === "fr"
      ? `Votre commande ${input.orderId} est maintenant ${statusLabel}.`
      : `Your order ${input.orderId} is now ${statusLabel}.`;
  return {
    title,
    body,
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: "/account/orders", orderId: input.orderId, status },
  };
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; icon?: string; badge?: string; data?: Record<string, string> },
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, platform")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Pick<PushRow, "id" | "endpoint" | "p256dh" | "auth" | "platform">[];
  if (!rows.length) return { sent: 0, removed: 0 };

  configureWebPush();
  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    rows.map(async (row) => {
      if (row.platform !== "web" || !row.p256dh || !row.auth) {
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          removed += 1;
        } else {
          console.error("web-push send failed", row.id, err);
        }
      }
    }),
  );

  return { sent, removed };
}
