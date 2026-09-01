export type {
  PageKind,
  PageFetchStatus,
  PageHeading,
  PageImageRef,
  PageScriptRef,
  PageStylesheetRef,
  PageLinkRef,
  PageOpenGraph,
  PageScanResult,
  StorefrontTargets,
  StorefrontCollectionResult,
} from "./types.ts";

export {
  parsePageHtml,
  extractTitle,
  extractMetaDescription,
  extractCanonicalUrl,
  extractOpenGraph,
  extractHeadings,
  extractImages,
  extractScripts,
  extractStylesheets,
  extractLinks,
  detectNonPublicPage,
} from "./parse-html.ts";

export { fetchPublicPage } from "./fetch-page.ts";

export {
  resolveStorefrontTargets,
  discoverTargetsFromHomepageLinks,
} from "./discover.ts";

export {
  collectStorefrontData,
  type CollectStorefrontOptions,
} from "./collector.ts";

export {
  unlockStorefrontPassword,
  getConfiguredStorefrontPassword,
} from "./unlock-password.ts";
