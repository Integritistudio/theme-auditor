export type {
  ProductBatchData,
  ProductCatalogIndex,
} from "./types.ts";
export {
  SHORT_DESCRIPTION_THRESHOLD,
  normalizeProductTitleKey,
  isBlank,
} from "./types.ts";

export {
  PRODUCT_BATCH_RULES,
  noImagesRule,
  imagesMissingAltRule,
  missingSeoTitleRule,
  missingSeoDescriptionRule,
  shortDescriptionRule,
  missingProductTypeRule,
  duplicateTitleRule,
} from "./rules/index.ts";

export {
  detectedIssueToCreateInput,
  saveDetectedIssues,
} from "./persist.ts";

export {
  runProductScanner,
  syncProductScanCounters,
  type ProductScannerOptions,
  type ProductScannerResult,
  type ProductSeoSnapshot,
} from "./scanner.ts";
