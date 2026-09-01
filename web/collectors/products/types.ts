/**
 * Normalized product types for StoreAudit AI.
 * Auditing rules should depend on these shapes, not raw Shopify GraphQL payloads.
 */

export type InternalProductStatus =
  | "ACTIVE"
  | "ARCHIVED"
  | "DRAFT"
  | "UNKNOWN";

export interface InternalProductImage {
  /** Shopify media/image GID. */
  id: string;
  /** CDN URL for the image, when available. */
  url: string | null;
  /** Alternative text (may be empty string or null when missing). */
  altText: string | null;
}

export interface InternalProduct {
  /** Shopify product GID (e.g. gid://shopify/Product/123). */
  id: string;
  title: string;
  /** Plain-text description preferred; falls back from HTML when needed. */
  description: string;
  productType: string;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: InternalProductStatus;
  images: InternalProductImage[];
}

export interface ProductCollectionPageMeta {
  pageNumber: number;
  fetchedInPage: number;
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ProductCollectionResult {
  products: InternalProduct[];
  /** Total normalized products returned. */
  totalFetched: number;
  /** Number of product list pages requested from Shopify. */
  pageCount: number;
  /** True when stopped because maxProducts was reached. */
  truncated: boolean;
}

/** Raw Shopify product node fields used by the collector (subset). */
export interface ShopifyProductNode {
  id: string;
  title?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  productType?: string | null;
  tags?: string[] | string | null;
  status?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
  } | null;
  media?: {
    nodes?: Array<ShopifyMediaNode | null> | null;
    pageInfo?: {
      hasNextPage: boolean;
      endCursor?: string | null;
    } | null;
  } | null;
}

export interface ShopifyMediaNode {
  id?: string | null;
  alt?: string | null;
  image?: {
    url?: string | null;
    altText?: string | null;
  } | null;
}

export interface ShopifyProductsPage {
  nodes: ShopifyProductNode[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}
