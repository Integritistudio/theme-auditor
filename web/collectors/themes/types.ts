/**
 * Normalized theme types for StoreAudit AI theme auditing.
 * Rules depend on these shapes, not raw Shopify GraphQL payloads.
 */

export type ThemeAssetKind = "javascript" | "css" | "liquid" | "other";

export interface InternalThemeAsset {
  /** Theme-relative path, e.g. assets/theme.js */
  filename: string;
  contentType: string;
  /** File size in bytes when Shopify provides it. */
  sizeBytes: number | null;
  checksumMd5: string | null;
  kind: ThemeAssetKind;
  /** Text content when retrieved (used for Liquid script extraction). */
  textContent: string | null;
}

export interface InternalScriptReference {
  /** Exact src attribute value as authored in Liquid. */
  src: string;
  /** Normalized URL key used for duplicate external URL detection. */
  normalizedUrl: string;
  /** Liquid file where the reference was found. */
  sourceFile: string;
  async: boolean;
  defer: boolean;
  /** script type attribute, if present. */
  type: string | null;
  /** True when the tag appears inside <head> of a layout file. */
  inHead: boolean;
  /** Absolute http(s) URL pointing off the shop theme asset path. */
  isExternal: boolean;
  /** Shopify CDN / myshopify hosted. */
  isShopifyHosted: boolean;
  /** True when type=module (browser defers by default). */
  isModule: boolean;
  rawTag: string;
}

export interface InternalThemeData {
  themeId: string;
  themeName: string;
  themeRole: string;
  shopDomain: string | null;
  assets: InternalThemeAsset[];
  scriptReferences: InternalScriptReference[];
}

export interface ThemeCollectionResult {
  theme: InternalThemeData;
  filesFetched: number;
  pageCount: number;
}

/** Raw Shopify theme file node (subset). */
export interface ShopifyThemeFileNode {
  filename?: string | null;
  contentType?: string | null;
  size?: string | number | null;
  checksumMd5?: string | null;
  body?: {
    content?: string | null;
    contentBase64?: string | null;
    url?: string | null;
  } | null;
}
