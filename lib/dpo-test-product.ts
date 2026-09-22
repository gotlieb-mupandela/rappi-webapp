import type { Product } from "@/lib/types";

export const DPO_TEST_CODE = "DPO-TEST";

/** N$10 checkout product. One size, kept out of the baked Joma catalog. */
export const dpoTestProduct: Product = {
  id: "dpo-test",
  code: DPO_TEST_CODE,
  item: "DPO Test",
  title: "DPO Test",
  name: "DPO Test",
  displayName: "DPO Test",
  category: "sportswear",
  subcategory: "Test",
  gender: "unisex",
  price: 10,
  unitPrice: 10,
  currency: "NAD",
  sheetCategory: "DPO",
  totalQty: 999,
  stockQty: 999,
  badge: null,
  sizeOptions: ["ONE"],
  sizes: [{ size: "ONE", stock: 999 }],
  imageUrl: "/dpo-test.svg",
  images: ["/dpo-test.svg"],
  description: "N$10 payment test product.",
};
