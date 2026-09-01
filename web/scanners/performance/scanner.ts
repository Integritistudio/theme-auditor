import type { PageScanResult } from "../../collectors/storefront/types.ts";
import type { StorefrontCollectionResult } from "../../collectors/storefront/types.ts";
import { collectStorefrontData } from "../../collectors/storefront/index.ts";
import type { ShopifyGraphqlSession } from "../../collectors/products/index.ts";
import { runRules } from "../../rules/runner.ts";
import { setScanProgress } from "../../scans/lifecycle.ts";
import { recalculateAndPersistScanScores } from "../../scoring/index.ts";
import { saveDetectedIssues } from "../products/persist.ts";
import { buildSectionPerformanceData } from "./extract-sections.ts";
import {
  PAGE_PERFORMANCE_RULES,
  SECTION_PERFORMANCE_RULES,
} from "./rules/index.ts";
import type { ExtractedSection } from "./types.ts";

export interface PerformanceScannerOptions {
  scanId: string;
  session: ShopifyGraphqlSession;
  shopDomain?: string;
  pages?: PageScanResult[];
  storefront?: StorefrontCollectionResult;
}

export interface PerformanceScannerResult {
  pagesAnalyzed: number;
  sectionsAnalyzed: number;
  issuesSaved: number;
  rulesFailed: number;
  topHeavySections: Array<{
    sectionType: string;
    pageKind: string;
    pageUrl: string;
    weightScore: number;
  }>;
}

const PERF_PROGRESS = 86;

function topHeavy(sections: ExtractedSection[], limit = 5) {
  return [...sections]
    .sort((a, b) => b.weightScore - a.weightScore)
    .slice(0, limit)
    .map((s) => ({
      sectionType: s.sectionType,
      pageKind: s.pageKind,
      pageUrl: s.pageUrl,
      weightScore: s.weightScore,
    }));
}

/**
 * Section performance scanner: estimate which theme sections are likely slow
 * from rendered storefront HTML (not measured timings).
 */
export async function runPerformanceScanner(
  options: PerformanceScannerOptions
): Promise<PerformanceScannerResult> {
  const { scanId, session, shopDomain } = options;

  await setScanProgress(scanId, "ANALYSIS", PERF_PROGRESS);

  let pages = options.pages;
  if (!pages) {
    const storefront =
      options.storefront ||
      (await collectStorefrontData(session, {
        shopDomain: shopDomain || session.shop,
      }));
    pages = storefront.pages;
  }

  const data = buildSectionPerformanceData(pages);
  const sectionSummary = await runRules(SECTION_PERFORMANCE_RULES, data, {
    context: {
      scanId,
      shopDomain: shopDomain || session.shop,
      extras: {
        sectionsAnalyzed: data.sections.length,
        pagesAnalyzed: pages.filter((p) => p.status === "OK").length,
      },
    },
  });

  const pageSummary = await runRules(
    PAGE_PERFORMANCE_RULES,
    { pages },
    {
      context: {
        scanId,
        shopDomain: shopDomain || session.shop,
        extras: {
          pagesAnalyzed: pages.filter((p) => p.status === "OK").length,
        },
      },
    }
  );

  const allIssues = [...sectionSummary.issues, ...pageSummary.issues];
  const issuesSaved = await saveDetectedIssues(scanId, allIssues);
  await recalculateAndPersistScanScores(scanId);

  return {
    pagesAnalyzed: pages.filter((p) => p.status === "OK").length,
    sectionsAnalyzed: data.sections.length,
    issuesSaved,
    rulesFailed: sectionSummary.rulesFailed + pageSummary.rulesFailed,
    topHeavySections: topHeavy(data.sections),
  };
}
