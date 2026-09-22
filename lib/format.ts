/** Format a Namibian dollar amount. Whole catalog prices stay N$120; VAT/totals can show cents. */
export function formatPrice(value: number) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  const whole = Number.isInteger(rounded);
  const n = new Intl.NumberFormat("en-NA", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `N$${n}`;
}

export function roundNad(value: number) {
  return Math.round(Number(value) || 0);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  }).format(new Date(iso));
}
