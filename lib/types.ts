export type SizeStock = {
  size: string;
  stock: number;
};

export type Product = {
  id: string;
  code: string;
  item: string;
  title: string;
  name: string;
  displayName: string;
  category: string;
  /** Extra hubs this SKU should appear in (primary hub stays `category`). */
  hubs?: string[];
  subcategory: string;
  gender: "men" | "women" | "kids" | "unisex";
  price: number;
  unitPrice: number;
  currency: "NAD";
  sheetCategory: string | null;
  totalQty: number;
  stockQty: number;
  badge: "new" | "offer" | null;
  sizeOptions: string[];
  sizes: SizeStock[];
  imageUrl: string;
  images: string[];
  description?: string;
};

/** Product fields persisted on each cart line so the client never loads the catalog JSON. */
export type CartLineSnapshot = {
  id: string;
  name: string;
  displayName: string;
  title: string;
  item: string;
  price: number;
  unitPrice: number;
  imageUrl: string;
  sizeStock: number;
  stockQty: number;
  category: string;
  subcategory: string;
  gender: Product["gender"];
  badge: Product["badge"];
};

export type CartLine = {
  code: string;
  size: string;
  qty: number;
} & CartLineSnapshot;

export type Order = {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
  shippingMethod: string;
  shippingCost: number;
  vatRate?: number;
  vatAmount?: number;
  items: Array<{
    code: string;
    name: string;
    size: string;
    qty: number;
    price: number;
  }>;
  subtotal: number;
  total: number;
  status: "reserved" | "preparing" | "shipped" | "cancelled";
  remote?: boolean;
};

export type User = {
  email: string;
  name: string;
};
