import type { PageScanResult } from "../../collectors/storefront/types.ts";
import type { StorefrontCollectionResult } from "../../collectors/storefront/types.ts";
import { collectStorefrontData } from "../../collectors/storefront/index.ts";
import type { ShopifyGraphqlSession } from "../../collectors/products/index.ts";
import { runRules } from "../../rules/runner.ts";
import { setScanProgress } from "../../scans/lifecycle.ts";
import { recalculateAndPersistScanScores } from "../../scoring/index.ts";
import { saveDetectedIssues } from "../products/persist.ts";
import { buildA11yPageSnapshots } from "./extract.ts";
import { ACCESSIBILITY_RULES } from "./rules/index.ts";

export interface AccessibilityScannerOptions {
  scanId: string;
  session: ShopifyGraphqlSession;
  shopDomain?: string;
  /** Reuse storefront pages already collected in this scan. */
  pages?: PageScanResult[];
  storefront?: StorefrontCollectionResult;
}

export interface AccessibilityScannerResult {
  pagesAnalyzed: number;
  issuesSaved: number;
  rulesFailed: number;
  confirmed: number;
  potential: number;
  manualReview: number;
}

const A11Y_PROGRESS = 82;

/**
 * Accessibility scanner over public storefront HTML.
 * Classifications are stored on each issue as metadata.classification.
 */
export async function runAccessibilityScanner(
  options: AccessibilityScannerOptions
): Promise<AccessibilityScannerResult> {
  const { scanId, session, shopDomain } = options;

  await setScanProgress(scanId, "ANALYSIS", A11Y_PROGRESS);

  let pages = options.pages;
  if (!pages) {
    const storefront =
      options.storefront ||
      (await collectStorefrontData(session, {
        shopDomain: shopDomain || session.shop,
      }));
    pages = storefront.pages;
  }

  const snapshots = buildA11yPageSnapshots(pages);
  const summary = await runRules(
    ACCESSIBILITY_RULES,
    { pages: snapshots },
    {
      context: {
        scanId,
        shopDomain: shopDomain || session.shop,
        extras: {
          pagesAnalyzed: snapshots.length,
        },
      },
    }
  );

  const issuesSaved = await saveDetectedIssues(scanId, summary.issues);
  await recalculateAndPersistScanScores(scanId);

  let confirmed = 0;
  let potential = 0;
  let manualReview = 0;
  for (const issue of summary.issues) {
    const c = issue.metadata?.classification;
    if (c === "CONFIRMED") confirmed += 1;
    else if (c === "POTENTIAL") potential += 1;
    else if (c === "MANUAL_REVIEW") manualReview += 1;
  }

  return {
    pagesAnalyzed: snapshots.length,
    issuesSaved,
    rulesFailed: summary.rulesFailed,
    confirmed,
    potential,
    manualReview,
  };
}
