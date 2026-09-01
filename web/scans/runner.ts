import type { ShopifyGraphqlSession } from "../collectors/products/collector.ts";
import { collectStorefrontData } from "../collectors/storefront/index.ts";
import { runProductScanner } from "../scanners/products/index.ts";
import { runThemeScanner } from "../scanners/themes/index.ts";
import { runSeoScanner } from "../scanners/seo/index.ts";
import { runAccessibilityScanner } from "../scanners/accessibility/index.ts";
import { runPerformanceScanner } from "../scanners/performance/index.ts";
import { recalculateAndPersistScanScores } from "../scoring/index.ts";
import { enqueueAiAnalysis } from "../ai/index.ts";
import { getScanById } from "../db/repositories/scans.repository.ts";
import {
  markScanCompleted,
  markScanFailed,
  markScanRunning,
  setScanProgress,
} from "./lifecycle.ts";

export interface RunScanOptions {
  scanId: string;
  session: ShopifyGraphqlSession;
  shopDomain?: string;
}

/**
 * Full scan orchestrator connected to the scan lifecycle.
 */
export async function runScan(options: RunScanOptions): Promise<void> {
  const { scanId, session, shopDomain } = options;

  try {
    await markScanRunning(scanId);

    // STORE_DATA — placeholder until a dedicated store-data collector exists.
    await setScanProgress(scanId, "STORE_DATA", 5);

    // PRODUCTS
    const productResult = await runProductScanner({
      scanId,
      session,
      shopDomain: shopDomain || session.shop,
    });
    console.log(
      `✅ Product scanner finished for ${scanId}: ` +
        `${productResult.productsProcessed} products, ` +
        `${productResult.issuesSaved} issues, ` +
        `${productResult.pageCount} pages` +
        (productResult.truncated ? " (truncated)" : "")
    );

    // THEME
    const themeResult = await runThemeScanner({
      scanId,
      session,
      shopDomain: shopDomain || session.shop,
    });
    console.log(
      `✅ Theme scanner finished for ${scanId}: ` +
        `${themeResult.themeName} (${themeResult.filesFetched} files, ` +
        `${themeResult.scriptReferences} script refs, ` +
        `${themeResult.issuesSaved} issues)`
    );

    // STOREFRONT (shared by SEO + accessibility)
    await setScanProgress(scanId, "STOREFRONT", 60);
    const storefront = await collectStorefrontData(session, {
      shopDomain: shopDomain || session.shop,
    });

    const seoResult = await runSeoScanner({
      scanId,
      session,
      shopDomain: shopDomain || session.shop,
      products: productResult.seoProducts,
      storefront,
      pages: storefront.pages,
    });
    console.log(
      `✅ SEO scanner finished for ${scanId}: ` +
        `${seoResult.pagesOk}/${seoResult.pagesScanned} pages OK, ` +
        `${seoResult.productsConsidered} products, ` +
        `${seoResult.issuesSaved} issues`
    );

    // ANALYSIS / accessibility
    const a11yResult = await runAccessibilityScanner({
      scanId,
      session,
      shopDomain: shopDomain || session.shop,
      pages: storefront.pages,
      storefront,
    });
    console.log(
      `✅ Accessibility scanner finished for ${scanId}: ` +
        `${a11yResult.pagesAnalyzed} pages, ${a11yResult.issuesSaved} issues ` +
        `(confirmed=${a11yResult.confirmed}, potential=${a11yResult.potential}, ` +
        `manual=${a11yResult.manualReview})`
    );

    // Section load-risk estimates from rendered storefront HTML
    const perfResult = await runPerformanceScanner({
      scanId,
      session,
      shopDomain: shopDomain || session.shop,
      pages: storefront.pages,
      storefront,
    });
    console.log(
      `✅ Section performance scanner finished for ${scanId}: ` +
        `${perfResult.sectionsAnalyzed} sections on ${perfResult.pagesAnalyzed} pages, ` +
        `${perfResult.issuesSaved} issues`
    );

    await setScanProgress(scanId, "ANALYSIS", 90);

    // Final deterministic score persistence (all issues available).
    const { scores } = await recalculateAndPersistScanScores(scanId);
    console.log(
      `✅ Scores for ${scanId}: overall=${scores.overallScore} ` +
        `perf=${scores.performanceScore} seo=${scores.seoScore} ` +
        `a11y=${scores.accessibilityScore} theme=${scores.themeScore} ` +
        `product=${scores.productScore}`
    );

    await markScanCompleted(scanId);
    console.log(`✅ Scan completed: ${scanId}`);

    // AI explains rule-engine findings only; never blocks scan completion.
    const completedScan = await getScanById(scanId);
    if (completedScan) {
      enqueueAiAnalysis({
        scanId,
        shopId: completedScan.shop_id,
        shopDomain: shopDomain || session.shop,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scan failed unexpectedly";
    console.error(`❌ Scan failed (${scanId}):`, message);

    try {
      await markScanFailed(scanId, message);
    } catch (failError) {
      console.error(
        `❌ Unable to persist FAILED status for scan ${scanId}:`,
        failError
      );
    }
  }
}

/**
 * Starts a scan without blocking the HTTP response.
 */
export function enqueueScan(
  scanId: string,
  session: ShopifyGraphqlSession
): void {
  const sessionCopy: ShopifyGraphqlSession = {
    shop: session.shop,
    accessToken: session.accessToken,
  };

  setImmediate(() => {
    void runScan({
      scanId,
      session: sessionCopy,
      shopDomain: sessionCopy.shop,
    });
  });
}
