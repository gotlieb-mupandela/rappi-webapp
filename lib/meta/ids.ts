/** Meta catalog retailer id for a size variant. Must stay in sync with Pixel content_ids. */
export function feedVariantId(code: string, size: string) {
  return `${code}_${size}`.replace(/[^\w.-]/g, "-").slice(0, 100);
}

export function feedGroupId(code: string) {
  return code.replace(/[^\w.-]/g, "-").slice(0, 100);
}
