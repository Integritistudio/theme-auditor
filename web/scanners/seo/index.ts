export type { SeoDocument, SeoRulesData } from "./types.ts";
export {
  buildSeoDocuments,
  pageToSeoDocument,
  productToSeoDocument,
  OG_RELEVANT_KINDS,
} from "./types.ts";

export {
  SEO_RULES,
  missingPageTitleRule,
  missingMetaDescriptionRule,
  missingH1Rule,
  multipleH1Rule,
  missingCanonicalRule,
  duplicatePageTitlesRule,
  duplicateMetaDescriptionsRule,
  missingOpenGraphRule,
} from "./rules/index.ts";

export {
  runSeoScanner,
  type SeoScannerOptions,
  type SeoScannerResult,
} from "./scanner.ts";
