/**
 * Online layby rules (Terms clause 7, Returns clause 8). Pure maths, shared by the server,
 * the checkout, My account and Admin.
 */

export const LAYBY = {
  /** Minimum merchandise value (N$) before delivery. */
  MIN_ORDER: 500,
  /** Share of the order total paid today. */
  DEPOSIT_RATE: 0.2,
  /** Smallest instalment (N$), unless the balance is smaller. */
  MIN_PAYMENT: 100,
  /** Months to pay the balance. */
  TERM_MONTHS: 3,
  /** Admin fee on cancellation, as a share of the order total (capped at the amount paid). */
  FEE_RATE: 0.3,
  /** Reminder this many days before each monthly date and the final date. */
  REMIND_DAYS: 7,
} as const;

export const money = (n: number) => Math.round(n * 100) / 100;

export function laybyDeposit(total: number) {
  return money(total * LAYBY.DEPOSIT_RATE);
}

export function laybyEligible(input: { merchandise: number; currency: string }) {
  return input.currency === "NAD" && input.merchandise >= LAYBY.MIN_ORDER;
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 Jan + 1 month -> last day of February, not 3 March.
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

export function laybyFinalDue(openedAt: Date) {
  return addMonths(openedAt, LAYBY.TERM_MONTHS);
}

/** Today's plan for a new layby: deposit now, the rest in TERM_MONTHS monthly amounts. */
export function laybyPlan(total: number, openedAt = new Date()) {
  const deposit = laybyDeposit(total);
  const balance = money(total - deposit);
  const monthly = money(Math.ceil((balance / LAYBY.TERM_MONTHS) * 100) / 100);
  const dates = Array.from({ length: LAYBY.TERM_MONTHS }, (_, i) => addMonths(openedAt, i + 1));
  return { total: money(total), deposit, balance, monthly, dates, finalDue: dates[dates.length - 1]! };
}

export function laybyBalance(l: { total: number; paid: number }) {
  return Math.max(0, money(Number(l.total) - Number(l.paid)));
}

/** Smallest and largest amount a customer may pay now. */
export function laybyPaymentLimits(l: { total: number; paid: number }) {
  const balance = laybyBalance(l);
  return { min: Math.min(LAYBY.MIN_PAYMENT, balance), max: balance };
}

export function validLaybyPayment(l: { total: number; paid: number }, amount: number) {
  const { min, max } = laybyPaymentLimits(l);
  return Number.isFinite(amount) && max > 0 && money(amount) >= min && money(amount) <= max;
}

/** Suggested next payment: what keeps the customer on track for the monthly plan. */
export function laybySuggested(l: { total: number; paid: number; opened_at: string }, now = new Date()) {
  const plan = laybyPlan(Number(l.total), new Date(l.opened_at));
  const due = plan.dates.filter((d) => d.getTime() <= now.getTime() + LAYBY.REMIND_DAYS * 86_400_000).length;
  const shouldHavePaid = money(Math.min(Number(l.total), plan.deposit + plan.monthly * Math.max(1, due)));
  const behind = money(shouldHavePaid - Number(l.paid));
  const { min, max } = laybyPaymentLimits(l);
  return Math.min(max, Math.max(min, behind > 0 ? behind : Math.min(plan.monthly, max)));
}

/** Fee and refund if the layby were cancelled now. */
export function laybyCancellation(l: { total: number; paid: number }) {
  const fee = money(Math.min(Number(l.total) * LAYBY.FEE_RATE, Number(l.paid)));
  return { fee, refund: money(Number(l.paid) - fee) };
}

export type LaybyState = "active" | "overdue" | "expired" | "paid" | "cancelled";

/**
 * "overdue": no payment for a month or more past the monthly plan; "expired": past the final date
 * with a balance. Both can be cancelled by staff after the warning email.
 */
export function laybyState(
  l: { status: string; total: number; paid: number; opened_at: string; final_due_at: string; last_payment_at: string | null },
  now = new Date(),
): LaybyState {
  if (l.status === "paid" || l.status === "cancelled") return l.status;
  if (laybyBalance(l) <= 0) return "paid";
  if (now.getTime() > new Date(l.final_due_at).getTime()) return "expired";
  const plan = laybyPlan(Number(l.total), new Date(l.opened_at));
  const passed = plan.dates.filter((d) => d.getTime() < now.getTime()).length;
  const expected = money(Math.min(Number(l.total), plan.deposit + plan.monthly * passed));
  return Number(l.paid) + 0.01 < expected ? "overdue" : "active";
}

/** Can staff cancel for non-payment now (3 months without payment, or past the final date)? */
export function laybyCancellableForNonPayment(
  l: { status: string; final_due_at: string; last_payment_at: string | null; opened_at: string },
  now = new Date(),
) {
  if (l.status !== "active") return false;
  if (now.getTime() > new Date(l.final_due_at).getTime()) return true;
  const last = new Date(l.last_payment_at ?? l.opened_at);
  return now.getTime() >= addMonths(last, LAYBY.TERM_MONTHS).getTime();
}

/** Which reminder email (if any) is due today. Keys are stable so each goes out once. */
export function laybyReminderDue(
  l: { status: string; total: number; paid: number; opened_at: string; final_due_at: string; last_payment_at: string | null },
  now = new Date(),
): { kind: string; date: Date; final: boolean } | null {
  if (l.status !== "active" || laybyBalance(l) <= 0) return null;
  const plan = laybyPlan(Number(l.total), new Date(l.opened_at));
  const final = new Date(l.final_due_at);
  if (now.getTime() > final.getTime()) return { kind: "expired_notice", date: final, final: true };
  for (const [i, d] of plan.dates.entries()) {
    const from = d.getTime() - LAYBY.REMIND_DAYS * 86_400_000;
    if (now.getTime() >= from && now.getTime() <= d.getTime()) {
      const isFinal = i === plan.dates.length - 1;
      return { kind: isFinal ? "reminder_final" : `reminder_${i + 1}`, date: d, final: isFinal };
    }
  }
  return null;
}
