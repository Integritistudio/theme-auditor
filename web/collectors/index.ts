export {
  collectProducts,
  normalizeShopifyProduct,
  normalizeShopifyProducts,
  type CollectProductsOptions,
  type InternalProduct,
  type InternalProductImage,
  type InternalProductStatus,
  type ProductCollectionResult,
} from "./products/index.ts";

export {
  collectThemeData,
  normalizeThemeAsset,
  extractScriptReferences,
  type CollectThemeOptions,
  type InternalThemeData,
  type InternalThemeAsset,
  type InternalScriptReference,
  type ThemeCollectionResult,
} from "./themes/index.ts";

export {
  collectStorefrontData,
  fetchPublicPage,
  parsePageHtml,
  type CollectStorefrontOptions,
  type PageScanResult,
  type StorefrontCollectionResult,
  type PageKind,
  type PageFetchStatus,
  type PageOpenGraph,
} from "./storefront/index.ts";
