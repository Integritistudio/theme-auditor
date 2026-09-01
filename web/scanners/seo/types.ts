import type { InternalProduct } from "../../collectors/products/types.ts";
import type {
  PageKind,
  PageOpenGraph,
  PageScanResult,
} from "../../collectors/storefront/types.ts";
import type { ProductSeoSnapshot } from "../products/scanner.ts";

/**
 * Unified SEO document built from storefront pages and/or product SEO fields.
 */
export interface SeoDocument {
  id: string;
  source: "page" | "product";
  kind: PageKind | "PRODUCT_ADMIN";
  url: string | null;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  h1Texts: string[];
  openGraph: PageOpenGraph | null;
  /** Only page-source docs with status OK are audited for on-page rules. */
  scannable: boolean;
}

export interface SeoRulesData {
  documents: SeoDocument[];
  pages: PageScanResult[];
  products: ProductSeoSnapshot[];
}

export function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function normalizeSeoText(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Page kinds where Open Graph tags are expected for social sharing. */
export const OG_RELEVANT_KINDS: ReadonlySet<PageKind> = new Set([
  "HOME",
  "PRODUCT",
  "COLLECTION",
]);

export function pageToSeoDocument(page: PageScanResult): SeoDocument {
  return {
    id: page.finalUrl || page.requestedUrl,
    source: "page",
    kind: page.kind,
    url: page.finalUrl || page.requestedUrl,
    title: page.title,
    metaDescription: page.metaDescription,
    canonicalUrl: page.canonicalUrl,
    h1Texts: page.headings.filter((h) => h.level === 1).map((h) => h.text),
    openGraph: page.openGraph,
    scannable: page.status === "OK",
  };
}

export function productToSeoDocument(
  product: ProductSeoSnapshot | InternalProduct
): SeoDocument {
  return {
    id: product.id,
    source: "product",
    kind: "PRODUCT_ADMIN",
    url: null,
    title: product.seoTitle || product.title || null,
    metaDescription: product.seoDescription,
    canonicalUrl: null,
    h1Texts: [],
    openGraph: null,
    // Product admin SEO participates in duplicate title/meta checks only.
    scannable: false,
  };
}

export function buildSeoDocuments(
  pages: PageScanResult[],
  products: ProductSeoSnapshot[]
): SeoDocument[] {
  return [
    ...pages.map(pageToSeoDocument),
    ...products.map(productToSeoDocument),
  ];
}
