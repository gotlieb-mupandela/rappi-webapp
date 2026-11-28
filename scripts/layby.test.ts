import assert from "node:assert/strict";
import { test } from "node:test";
import {
  laybyBalance,
  laybyCancellableForNonPayment,
  laybyCancellation,
  laybyDeposit,
  laybyEligible,
  laybyPlan,
  laybyReminderDue,
  laybyState,
  laybySuggested,
  validLaybyPayment,
  addMonths,
} from "../lib/layby";

const opened = "2026-11-28T10:00:00Z";
const base = { status: "active", total: 1282, paid: 256.4, opened_at: opened, final_due_at: "2027-02-28T10:00:00Z", last_payment_at: opened };

test("deposit is 20% and the plan adds up", () => {
  assert.equal(laybyDeposit(1282), 256.4);
  const p = laybyPlan(1282, new Date(opened));
  assert.equal(p.balance, 1025.6);
  assert.ok(p.monthly * 3 >= p.balance && p.monthly * 3 - p.balance < 0.03);
  assert.equal(p.finalDue.toISOString().slice(0, 10), "2027-02-28");
});

test("eligibility: NAD and at least N$500 of merchandise", () => {
  assert.equal(laybyEligible({ merchandise: 499.99, currency: "NAD" }), false);
  assert.equal(laybyEligible({ merchandise: 500, currency: "NAD" }), true);
  assert.equal(laybyEligible({ merchandise: 2000, currency: "EUR" }), false);
});

test("month ends are clamped", () => {
  assert.equal(addMonths(new Date("2027-01-31T00:00:00Z"), 1).toISOString().slice(0, 10), "2027-02-28");
});

test("payment limits: min N$100 unless the balance is smaller, never above the balance", () => {
  assert.equal(validLaybyPayment(base, 99), false);
  assert.equal(validLaybyPayment(base, 100), true);
  assert.equal(validLaybyPayment(base, 1025.6), true);
  assert.equal(validLaybyPayment(base, 1025.61), false);
  const almost = { ...base, paid: 1232 };
  assert.equal(laybyBalance(almost), 50);
  assert.equal(validLaybyPayment(almost, 50), true);
  assert.equal(validLaybyPayment(almost, 49), false);
});

test("cancellation fee is 30% of the total, capped at what was paid", () => {
  assert.deepEqual(laybyCancellation({ total: 1282, paid: 600 }), { fee: 384.6, refund: 215.4 });
  assert.deepEqual(laybyCancellation({ total: 1282, paid: 256.4 }), { fee: 256.4, refund: 0 });
});

test("state: active, overdue after a missed month, expired after the final date, paid", () => {
  assert.equal(laybyState(base, new Date("2026-12-20T00:00:00Z")), "active");
  assert.equal(laybyState(base, new Date("2027-01-05T00:00:00Z")), "overdue");
  assert.equal(laybyState({ ...base, paid: 600 }, new Date("2027-01-05T00:00:00Z")), "active");
  assert.equal(laybyState(base, new Date("2027-03-01T00:00:00Z")), "expired");
  assert.equal(laybyState({ ...base, paid: 1282 }, new Date("2027-01-05T00:00:00Z")), "paid");
});

test("suggested payment keeps the customer on plan", () => {
  const s1 = laybySuggested(base, new Date("2026-12-01T00:00:00Z"));
  assert.ok(Math.abs(s1 - 341.87) < 0.02, String(s1));
  const s2 = laybySuggested(base, new Date("2027-01-27T00:00:00Z"));
  assert.ok(s2 > 680, String(s2));
});

test("reminders: 7 days before each monthly date, then expired notice", () => {
  assert.equal(laybyReminderDue(base, new Date("2026-12-10T00:00:00Z")), null);
  assert.equal(laybyReminderDue(base, new Date("2026-12-22T00:00:00Z"))?.kind, "reminder_1");
  assert.equal(laybyReminderDue(base, new Date("2027-02-25T00:00:00Z"))?.kind, "reminder_final");
  assert.equal(laybyReminderDue(base, new Date("2027-03-02T00:00:00Z"))?.kind, "expired_notice");
  assert.equal(laybyReminderDue({ ...base, status: "paid" }, new Date("2026-12-22T00:00:00Z")), null);
});

test("staff may cancel for non-payment after 3 months without payment or past the final date", () => {
  assert.equal(laybyCancellableForNonPayment(base, new Date("2027-02-01T00:00:00Z")), false);
  assert.equal(laybyCancellableForNonPayment(base, new Date("2027-02-28T10:00:01Z")), true);
  assert.equal(laybyCancellableForNonPayment({ ...base, status: "paid" }, new Date("2027-04-01T00:00:00Z")), false);
});
