import type { ListingAudience } from "@/lib/audience";
import type { Product } from "@/lib/types";

export const LISTING_PAGE_SIZE = 24;

/** Slim catalog row for client listing (full Product fields + search/facet helpers). */
export type ListingItem = Product & {
  audience?: ListingAudience;
  hay?: string;
};

export type ListingFilterOpts = {
  categorySlug?: string;
  requireQuery?: boolean;
  pageSize?: number;
  badges?: Array<NonNullable<Product["badge"]>>;
};

export type ListingQuery = {
  q?: string;
  cat?: string;
  sub?: string;
  group?: string;
  size?: string;
  max?: string;
  audience?: string;
  page?: string | number;
};

export type ListingFacet = { slug: string; name: string; count: number };

export type ListingResult = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  query: string;
  facets: {
    categories: ListingFacet[];
    audiences: ListingFacet[];
    subs: ListingFacet[];
    sizes: string[];
  };
};

export type TaxonomySub = { slug: string; name: string; count: number };
export type StorefrontTaxonomy = Record<string, TaxonomySub[]>;
