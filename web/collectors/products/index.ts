export type {
  InternalProduct,
  InternalProductImage,
  InternalProductStatus,
  ProductCollectionPageMeta,
  ProductCollectionResult,
  ShopifyProductNode,
  ShopifyMediaNode,
  ShopifyProductsPage,
} from "./types.ts";

export {
  normalizeShopifyMediaImage,
  normalizeShopifyMediaImages,
  normalizeShopifyProduct,
  normalizeShopifyProducts,
} from "./normalize.ts";

export {
  collectProducts,
  type CollectProductsOptions,
  type ShopifyGraphqlSession,
} from "./collector.ts";

export {
  COLLECT_PRODUCTS_QUERY,
  COLLECT_PRODUCT_MEDIA_QUERY,
} from "./queries.ts";
