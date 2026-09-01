export {
  runPerformanceScanner,
  type PerformanceScannerOptions,
  type PerformanceScannerResult,
} from "./scanner.ts";

export {
  buildSectionPerformanceData,
  extractShopifySectionsFromHtml,
  scoreSectionWeight,
  deriveSectionType,
} from "./extract-sections.ts";

export {
  SECTION_PERFORMANCE_RULES,
  PAGE_PERFORMANCE_RULES,
  sectionLoadRiskRule,
  duplicatePageScriptRule,
} from "./rules/index.ts";

export type {
  ExtractedSection,
  SectionPerformanceData,
  SectionImageFactor,
  PageKindLabel,
} from "./types.ts";

export {
  SECTION_WEIGHT_THRESHOLD,
  MAX_SECTION_ISSUES_PER_PAGE,
} from "./types.ts";
