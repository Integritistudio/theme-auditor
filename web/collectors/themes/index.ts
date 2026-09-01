export type {
  InternalThemeAsset,
  InternalScriptReference,
  InternalThemeData,
  ThemeCollectionResult,
  ThemeAssetKind,
  ShopifyThemeFileNode,
} from "./types.ts";

export {
  classifyThemeAssetKind,
  normalizeThemeAsset,
  extractScriptReferences,
  normalizeScriptUrl,
  isExternalScriptUrl,
  isShopifyHostedUrl,
  buildInternalThemeData,
} from "./normalize.ts";

export {
  collectThemeData,
  type CollectThemeOptions,
} from "./collector.ts";
