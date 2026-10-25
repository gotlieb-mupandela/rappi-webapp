import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { presentCheckoutFailure } from "@/lib/checkout-payment-error";
import { cancelVisitorMessageKey, trustForCheckoutCaller } from "@/lib/dpo-payment-access";
import { cancelDpoPayment } from "@/lib/dpo-payments";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("checkout.paymentCancelledTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{
    TransactionToken?: string;
    TransToken?: string;
    TransID?: string;
    CompanyRef?: string;
  }>;
}) {
  const params = await searchParams;
  const transToken = params.TransactionToken || params.TransToken || params.TransID || null;
  const companyRef = params.CompanyRef || null;
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body = t("checkout.checkoutClosedBeforePayment");
  if (transToken || companyRef) {
    try {
      const result = await cancelDpoPayment({
        transToken,
        companyRef,
        userId: user?.id,
        // Same trust rule as the return page. A signed-out cancel still
        // needs a TransactionToken that DPO has verified.
        trusted: trustForCheckoutCaller(user),
      });
      if (result.payment || result.status === "paid") {
        body = t(cancelVisitorMessageKey({ status: result.status, message: result.message }));
      }
    } catch (err) {
      body = presentCheckoutFailure(err, t("checkout.paymentConfirmFailed"), "cancel");
    }
  }

  return (
    <div className="page-shell py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/checkout", label: "Checkout" },
          { label: "Cancelled" },
        ]}
      />
      <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Payment</p>
      <h1 className="mt-2 font-[family-name:var(--font-oswald)] text-3xl uppercase sm:text-4xl">
        {t("checkout.paymentCancelledHeading")}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">{body}</p>
      <Button asChild className="mt-8">
        <Link href="/checkout">Back to checkout</Link>
      </Button>
    </div>
  );
}
