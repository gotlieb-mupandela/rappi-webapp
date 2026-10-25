import { verifyToken } from "@/lib/dpo";
import {
  DPO_CANCEL_CONFIRMING,
  commitPendingCancel,
  decideCancelAfterVerify,
  resolveDpoPaymentAccess,
  type DpoPaymentTrust,
} from "@/lib/dpo-payment-access";
import { createOrderFromPayment } from "@/lib/dpo-orders";
import { sendOrderInvoice } from "@/lib/invoice-email";
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
    case "001":
      return "paid";
    case "901":
      return "declined";
    case "903":
      return "expired";
    case "904":
      return "cancelled";
    case "900":
    case "003":
    case "007":
      return "pending";
    default:
      return "error";
  }
}

function paidMessage(result: string | null, explanation: string | null) {
  if (result === "001") return "Card authorized";
  return explanation ?? "Transaction Paid";
}

async function withOrder(payment: Payment | null, message: string, extra: Omit<DpoFulfillResult, "message" | "payment" | "orderId">): Promise<DpoFulfillResult> {
  let orderId = payment?.order_id ?? null;
  if (payment && extra.ok && extra.status === "paid") {
    try {
      orderId = (await createOrderFromPayment(payment)) ?? orderId;
    } catch {
      orderId = payment.order_id;
    }
    if (orderId) {
      try {
        await sendOrderInvoice(orderId);
      } catch (err) {
        console.error("invoice email", err);
      }
    }
  }
  return { ...extra, message, payment, orderId };
}

async function loadPayment(transToken: string | null, companyRef: string | null, tokenOnly: boolean) {
  const admin = createAdminClient();
  if (transToken) {
    const { data } = await admin
      .from("payments")
      .select("*")
      .eq("trans_token", transToken)
      .maybeSingle();
    if (data) return data;
  }
  if (tokenOnly || !companyRef) return null;
  const { data } = await admin.from("payments").select("*").eq("company_ref", companyRef).maybeSingle();
  return data ?? null;
}

const PAYMENT_NOT_FOUND: DpoFulfillResult = {
  ok: false,
  status: "error",
  message: "Payment not found.",
  payment: null,
  orderId: null,
};

async function authorizePayment(input: {
  transToken?: string | null;
  companyRef?: string | null;
  userId?: string | null;
  trusted?: DpoPaymentTrust;
}) {
  return resolveDpoPaymentAccess(input, {
    loadPayment,
    verifyToken,
  });
}

export async function fulfillDpoPayment(input: {
  transToken?: string | null;
  companyRef?: string | null;
  userId?: string | null;
  trusted?: DpoPaymentTrust;
}): Promise<DpoFulfillResult> {
  const access = await authorizePayment(input);
  if (!access) return PAYMENT_NOT_FOUND;
  const payment = access.payment;
  if (payment.status === "paid") {
    return withOrder(payment, "Already paid.", { ok: true, status: "paid" });
  }

  const token = access.transToken || payment.trans_token;
  if (!token) {
    return {
      ok: false,
      status: "error",
      message: "Missing transaction token.",
      payment,
      orderId: payment.order_id,
    };
  }

  const verified = access.verification ?? (await verifyToken(token));
  const admin = createAdminClient();
  const nextStatus = statusForResult(verified.result);

  if (verified.result === "000" || verified.result === "001") {
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
      paidMessage(verified.result, verified.explanation),
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
  userId?: string | null;
  trusted?: DpoPaymentTrust;
}): Promise<DpoFulfillResult> {
  const access = await authorizePayment(input);
  if (!access) return PAYMENT_NOT_FOUND;
  const payment = access.payment;
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

  const decided = await decideCancelAfterVerify({
    localStatus: payment.status,
    verify: async () => {
      if (access.verification) return access.verification;
      const token = access.transToken || payment.trans_token;
      if (!token) return { result: null };
      return verifyToken(token);
    },
  });
  if (!decided.update) {
    if (decided.outcome.status === "paid") {
      return {
        ok: true,
        status: "paid",
        message: decided.verifyResult?.trim() === "001" ? "Card authorized" : "Already paid.",
        payment,
        orderId: payment.order_id,
      };
    }
    if (decided.outcome.confirming) {
      return {
        ok: true,
        status: payment.status,
        message: DPO_CANCEL_CONFIRMING,
        payment,
        orderId: payment.order_id,
      };
    }
    return {
      ok: true,
      status: payment.status,
      message: `Payment is ${payment.status}.`,
      payment,
      orderId: payment.order_id,
    };
  }

  const admin = createAdminClient();
  const settled = await commitPendingCancel({
    update: decided.update,
    writeIfPending: async (update) => {
      const { data, error } = await admin
        .from("payments")
        .update(update)
        .eq("id", payment.id)
        .eq("status", "pending")
        .select("*");
      if (error) throw error;
      return data?.[0] ?? null;
    },
    reread: async () => {
      const { data, error } = await admin.from("payments").select("*").eq("id", payment.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!settled.payment || settled.status === "pending") {
    return {
      ok: true,
      status: "pending",
      message: DPO_CANCEL_CONFIRMING,
      payment: settled.payment ?? payment,
      orderId: settled.payment?.order_id ?? payment.order_id,
    };
  }
  if (settled.status === "paid") {
    return {
      ok: true,
      status: "paid",
      message: "Already paid.",
      payment: settled.payment,
      orderId: settled.payment.order_id,
    };
  }
  if (settled.status === "cancelled") {
    return {
      ok: true,
      status: "cancelled",
      message: "Payment cancelled.",
      payment: settled.payment,
      orderId: settled.payment.order_id,
    };
  }
  return {
    ok: true,
    status: settled.status,
    message: `Payment is ${settled.status}.`,
    payment: settled.payment,
    orderId: settled.payment.order_id,
  };
}
