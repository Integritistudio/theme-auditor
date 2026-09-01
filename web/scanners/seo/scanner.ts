import { collectStorefrontData } from "../../collectors/storefront/index.ts";
import type {
  PageScanResult,
  StorefrontCollectionResult,
} from "../../collectors/storefront/types.ts";
import type { ShopifyGraphqlSession } from "../../collectors/products/index.ts";
import { runRules } from "../../rules/runner.ts";
import { setScanProgress } from "../../scans/lifecycle.ts";
import { recalculateAndPersistScanScores } from "../../scoring/index.ts";
import { saveDetectedIssues } from "../products/persist.ts";
import type { ProductSeoSnapshot } from "../products/scanner.ts";
import { SEO_RULES } from "./rules/index.ts";
import { buildSeoDocuments } from "./types.ts";

export interface SeoScannerOptions {
  scanId: string;
  session: ShopifyGraphqlSession;
  shopDomain?: string;
  /** Product SEO snapshots collected during the product scanner stage. */
  products?: ProductSeoSnapshot[];
  /** Reuse storefront collection already fetched in this scan. */
  storefront?: StorefrontCollectionResult;
  pages?: PageScanResult[];
}

export interface SeoScannerResult {
  pagesScanned: number;
  pagesOk: number;
  productsConsidered: number;
  issuesSaved: number;
  rulesFailed: number;
  /** Pages used for this SEO pass (for downstream scanners). */
  pages: PageScanResult[];
  storefront: StorefrontCollectionResult | null;
}

const STOREFRONT_STAGE_START = 60;
const STOREFRONT_STAGE_MID = 70;
const STOREFRONT_STAGE_END = 79;

/**
 * SEO scanner: collect storefront pages (or reuse), combine with product SEO data,
 * run SEO rules, persist issues, update lifecycle progress.
 */
export async function runSeoScanner(
  options: SeoScannerOptions
): Promise<SeoScannerResult> {
  const { scanId, session, shopDomain } = options;
  const products = options.products || [];

  await setScanProgress(scanId, "STOREFRONT", STOREFRONT_STAGE_START);

  let storefront = options.storefront || null;
  let pages = options.pages;

  if (!pages) {
    storefront =
      storefront ||
      (await collectStorefrontData(session, {
        shopDomain: shopDomain || session.shop,
      }));
    pages = storefront.pages;
  }

  await setScanProgress(scanId, "STOREFRONT", STOREFRONT_STAGE_MID);

  const documents = buildSeoDocuments(pages, products);
  const summary = await runRules(
    SEO_RULES,
    {
      documents,
      pages,
      products,
    },
    {
      context: {
        scanId,
        shopDomain: shopDomain || session.shop,
        extras: {
          baseUrl: storefront?.baseUrl,
          pageCount: pages.length,
          productCount: products.length,
        },
      },
    }
  );

  const issuesSaved = await saveDetectedIssues(scanId, summary.issues);
  await recalculateAndPersistScanScores(scanId);
  await setScanProgress(scanId, "STOREFRONT", STOREFRONT_STAGE_END);

  return {
    pagesScanned: pages.length,
    pagesOk: pages.filter((p) => p.status === "OK").length,
    productsConsidered: products.length,
    issuesSaved,
    rulesFailed: summary.rulesFailed,
    pages,
    storefront,
  };
}
