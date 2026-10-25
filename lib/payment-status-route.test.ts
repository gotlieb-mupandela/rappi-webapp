import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("payment status returns 401 and no payment data without a user", () => {
  const source = readFileSync(new URL("../app/api/payments/dpo/status/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ownsPayment|customerOwnsPayment/);

  const gate = source.indexOf("if (!user) {");
  const denied = source.indexOf(
    'return NextResponse.json({ error: "Sign in required." }, { status: 401 });',
  );
  const query = source.indexOf('.from("payments")');
  assert.ok(gate > 0, "missing signed-out gate");
  assert.ok(denied > gate, "401 is not the signed-out branch");
  assert.ok(query > denied, "payment query runs before the 401");
  assert.doesNotMatch(source.slice(denied, denied + 80), /orderId|order_id|data\.status/);
});
