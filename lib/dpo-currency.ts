/** Currency sent to DPO. Existing `DPO_CURRENCY` env, otherwise NAD. */
export function dpoCurrency() {
  return process.env.DPO_CURRENCY || "NAD";
}
