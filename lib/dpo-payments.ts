import { verifyToken } from "@/lib/dpo";
import { createOrderFromPayment } from "@/lib/dpo-orders";
import { sendMetaPurchaseCapi } from "@/lib/meta/capi";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type Payment = Database["public"]["Tables"]["payments"]["Row"];

export type DpoFulfillResult = {
  ok: boolean;
  status: Payment["status"];
  message: string;
  payment: Payment | null;
  orderId: string | null;
};

function amountsMatch(expected: number, actual: string | null) {
  if (!actual) return false;
  return Math.abs(Number(actual) - Number(expected)) < 0.01;
}

function statusForResult(result: string | null): Payment["status"] {
  switch (result) {
    case "000":
      return "paid";
    case "901":
      return "declined";
    case "903":
      return "expired";
    case "904":
      return "cancelled";
    case "900":
    case "001":
    case "003":
    case "007":
      return "pending";
    default:
      return "error";
  }
}

async function withOrder(payment: Payment | null, message: string, extra: Omit<DpoFulfillResult, "message" | "payment" | "orderId">): Promise<DpoFulfillResult> {
  let orderId = payment?.order_id ?? null;
  if (payment && extra.ok && extra.status === "paid") {
    try {
      orderId = (await createOrderFromPayment(payment)) ?? orderId;
    } catch {
      orderId = payment.order_id;
    }
  }
  return { ...extra, message, payment, orderId };
}

async function loadPayment(transToken?: string | null, companyRef?: string | null) {
  const admin = createAdminClient();
  if (transToken) {
    const { data } = await admin
      .from("payments")
      .select("*")
      .eq("trans_token", transToken)
      .maybeSingle();
    if (data) return data;
  }
  if (companyRef) {
    const { data } = await admin
      .from("payments")
      .select("*")
      .eq("company_ref", companyRef)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

export async function fulfillDpoPayment(input: {
  transToken?: string | null;
  companyRef?: string | null;
}): Promise<DpoFulfillResult> {
  const payment = await loadPayment(input.transToken, input.companyRef);
  if (!payment) {
    return {
      ok: false,
      status: "error",
      message: "Payment not found.",
      payment: null,
      orderId: null,
    };
  }
  if (payment.status === "paid") {
    return withOrder(payment, "Already paid.", { ok: true, status: "paid" });
  }

  const token = input.transToken || payment.trans_token;
  if (!token) {
    return {
      ok: false,
      status: "error",
      message: "Missing transaction token.",
      payment,
      orderId: payment.order_id,
    };
  }

  const verified = await verifyToken(token);
  const admin = createAdminClient();
  const nextStatus = statusForResult(verified.result);

  if (verified.result === "000") {
    const currencyOk =
      !verified.transactionCurrency ||
      verified.transactionCurrency.toUpperCase() === payment.currency.toUpperCase();
    const amountOk = amountsMatch(Number(payment.amount), verified.transactionAmount);
    if (!currencyOk || !amountOk) {
      await admin
        .from("payments")
        .update({
          status: "error",
          verify_result: verified.result,
          raw_verify: verified.raw,
          trans_ref: verified.transRef ?? payment.trans_ref,
        })
        .eq("id", payment.id);
      return {
        ok: false,
        status: "error",
        message: "Paid amount or currency did not match.",
        payment,
        orderId: null,
      };
    }

    const { data: updated } = await admin
      .from("payments")
      .update({
        status: "paid",
        verify_result: verified.result,
        raw_verify: verified.raw,
        trans_token: token,
        trans_ref: verified.transRef ?? payment.trans_ref,
        paid_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    const paidPayment = updated ?? { ...payment, status: "paid" as const };
    try {
      await sendMetaPurchaseCapi(paidPayment);
    } catch (err) {
      console.error("Meta CAPI Purchase error", err);
    }

    return withOrder(
      paidPayment,
      verified.explanation ?? "Transaction Paid",
      { ok: true, status: "paid" },
    );
  }

  await admin
    .from("payments")
    .update({
      status: nextStatus,
      verify_result: verified.result,
      raw_verify: verified.raw,
      trans_token: token,
      trans_ref: verified.transRef ?? payment.trans_ref,
    })
    .eq("id", payment.id);

  return {
    ok: false,
    status: nextStatus,
    message: verified.explanation ?? `DPO result ${verified.result ?? "unknown"}`,
    payment,
    orderId: payment.order_id,
  };
}

export async function cancelDpoPayment(input: {
  transToken?: string | null;
  companyRef?: string | null;
}): Promise<DpoFulfillResult> {
  const payment = await loadPayment(input.transToken, input.companyRef);
  if (!payment) {
    return {
      ok: false,
      status: "error",
      message: "Payment not found.",
      payment: null,
      orderId: null,
    };
  }
  if (payment.status === "paid") {
    return withOrder(payment, "Already paid.", { ok: true, status: "paid" });
  }
  if (payment.status !== "pending") {
    return {
      ok: true,
      status: payment.status,
      message: `Payment is ${payment.status}.`,
      payment,
      orderId: payment.order_id,
    };
  }

  const admin = createAdminClient();
  const { data: updated } = await admin
    .from("payments")
    .update({ status: "cancelled", verify_result: "904" })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("*")
    .single();

  return {
    ok: true,
    status: "cancelled",
    message: "Payment cancelled.",
    payment: updated ?? { ...payment, status: "cancelled" },
    orderId: payment.order_id,
  };
}
