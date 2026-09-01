/**
 * Normalized public storefront page types for StoreAudit AI.
 * Auditing rules should depend on these shapes, not raw HTTP/HTML.
 */

export type PageKind = "HOME" | "PRODUCT" | "COLLECTION" | "CART";

/**
 * Outcome of attempting to fetch/parse a public page.
 * OK pages may still have redirected: true when a redirect chain was followed.
 */
export type PageFetchStatus =
  | "OK"
  | "FAILED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "PASSWORD_PROTECTED"
  | "NON_PUBLIC"
  | "TIMEOUT"
  | "ERROR";

export interface PageHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface PageImageRef {
  src: string | null;
  alt: string | null;
}

export interface PageScriptRef {
  src: string | null;
  inline: boolean;
  async: boolean;
  defer: boolean;
  type: string | null;
}

export interface PageStylesheetRef {
  href: string | null;
  inline: boolean;
  media: string | null;
}

export interface PageLinkRef {
  href: string | null;
  text: string;
  rel: string | null;
}

/** Open Graph tags extracted from the page head. */
export interface PageOpenGraph {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  type: string | null;
}

/**
 * Normalized result for one public storefront page fetch.
 */
export interface PageScanResult {
  kind: PageKind;
  requestedUrl: string;
  finalUrl: string | null;
  status: PageFetchStatus;
  httpStatus: number | null;
  redirected: boolean;
  redirectChain: string[];
  errorMessage: string | null;
  /** Raw HTML when successfully retrieved (may be truncated). */
  html: string | null;
  htmlTruncated: boolean;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  openGraph: PageOpenGraph;
  headings: PageHeading[];
  images: PageImageRef[];
  scripts: PageScriptRef[];
  stylesheets: PageStylesheetRef[];
  links: PageLinkRef[];
  fetchedAt: string;
  responseTimeMs: number | null;
}

export interface StorefrontTargets {
  homeUrl: string;
  productUrl: string | null;
  collectionUrl: string | null;
  cartUrl: string;
  baseUrl: string;
  shopDomain: string;
}

export interface StorefrontCollectionResult {
  shopDomain: string;
  baseUrl: string;
  targets: StorefrontTargets;
  pages: PageScanResult[];
  collectedAt: string;
}
