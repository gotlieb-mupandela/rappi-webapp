export function redactCheckoutSecrets(text: string) {
  return text
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(
      /\b(transactiontoken|transtoken|trans_token|companytoken|company_token|service_role(?:_key)?|apikey|api_key|access_token|refresh_token|authorization)\b\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .replace(/([?&](?:TransactionToken|TransToken|token|CompanyToken)=)[^&\s]+/gi, "$1[redacted]");
}

export function safeCheckoutError(err: unknown) {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      current = current.cause;
      continue;
    }
    if (typeof current === "string" && current.trim()) parts.push(current);
    break;
  }
  const text = redactCheckoutSecrets(parts.join(" ") || "Checkout payment error");
  return text.slice(0, 500);
}

export function logCheckoutPaymentError(scope: "return" | "cancel", err: unknown) {
  console.error(`checkout ${scope}`, safeCheckoutError(err));
}

/** Visitor copy only. The thrown error is logged and never returned. */
export function presentCheckoutFailure(
  err: unknown,
  visitorMessage: string,
  scope: "return" | "cancel",
) {
  logCheckoutPaymentError(scope, err);
  return visitorMessage;
}
