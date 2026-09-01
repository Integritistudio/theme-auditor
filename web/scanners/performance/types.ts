/**
 * Extracted Online Store 2.0 section snapshot from rendered storefront HTML.
 * Weight factors are estimates — not measured paint timings.
 */
export type PageKindLabel = "HOME" | "PRODUCT" | "COLLECTION" | "CART";

export interface SectionImageFactor {
  src: string | null;
  hasLazy: boolean;
  hasDimensions: boolean;
}

export interface SectionScriptFactor {
  src: string | null;
  inline: boolean;
  async: boolean;
  defer: boolean;
  /** Short preview of inline script body when src is absent */
  inlinePreview: string | null;
}

export interface SectionOffendingPart {
  part: string;
  detail: string;
}

export interface ExtractedSection {
  /** Shopify section DOM id, e.g. shopify-section-template--x__banner */
  sectionDomId: string;
  /** data-section-id when present */
  sectionId: string | null;
  /** Human-readable type/name derived from data-section-type or id */
  sectionType: string;
  pageKind: PageKindLabel;
  pageUrl: string;
  /** Outer HTML byte length (utf8) */
  htmlByteSize: number;
  /** Approximate nested element openings */
  approxNodeCount: number;
  images: SectionImageFactor[];
  imageCount: number;
  imagesMissingLazy: number;
  imagesMissingDimensions: number;
  scripts: SectionScriptFactor[];
  scriptCount: number;
  inlineScriptCount: number;
  externalScriptCount: number;
  iframeCount: number;
  iframeSrcs: string[];
  videoCount: number;
  /** Heuristic weight used for ranking (higher = likelier to slow load) */
  weightScore: number;
  /** Short machine-readable factor keys that contributed to weight */
  weightFactors: string[];
  /** Concrete parts of the section that drive risk */
  offendingParts: SectionOffendingPart[];
}

export interface SectionPerformanceData {
  sections: ExtractedSection[];
}

/** Emit issues when estimated weight meets or exceeds this. */
export const SECTION_WEIGHT_THRESHOLD = 10;

/** Cap findings per page so catalogs do not flood the issue list. */
export const MAX_SECTION_ISSUES_PER_PAGE = 5;
