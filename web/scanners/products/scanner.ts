import shopify from "../../shopify.js";
import {
  collectProducts,
  type ShopifyGraphqlSession,
} from "../../collectors/products/index.ts";
import { runRules } from "../../rules/runner.ts";
import { setScanProgress } from "../../scans/lifecycle.ts";
import { recalculateAndPersistScanScores } from "../../scoring/index.ts";
import { saveDetectedIssues } from "./persist.ts";
import { PRODUCT_BATCH_RULES } from "./rules/index.ts";
import { duplicateTitleRule } from "./rules/duplicate-title.rule.ts";
import {
  normalizeProductTitleKey,
  type ProductCatalogIndex,
} from "./types.ts";

export interface ProductScannerOptions {
  scanId: string;
  session: ShopifyGraphqlSession;
  shopDomain?: string;
  /** Shopify Admin products page size. Default 50. */
  pageSize?: number;
  /** Optional cap for testing. */
  maxProducts?: number;
  /** Known catalog size for progress interpolation (optional). */
  estimatedTotal?: number;
}

export interface ProductScannerResult {
  productsProcessed: number;
  pageCount: number;
  truncated: boolean;
  issuesSaved: number;
  rulesFailed: number;
  /** Lightweight product SEO fields for downstream scanners. */
  seoProducts: ProductSeoSnapshot[];
}

export interface ProductSeoSnapshot {
  id: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

const PRODUCTS_STAGE_START = 20;
const PRODUCTS_STAGE_END = 39;

function productsProgressPercent(
  processed: number,
  estimatedTotal: number | null
): number {
  if (!estimatedTotal || estimatedTotal <= 0) {
    // Unknown size: ease toward end of PRODUCTS band as pages accumulate.
    return Math.min(
      PRODUCTS_STAGE_END,
      PRODUCTS_STAGE_START + Math.floor(processed / 50)
    );
  }
  const ratio = Math.min(1, processed / estimatedTotal);
  return Math.round(
    PRODUCTS_STAGE_START +
      ratio * (PRODUCTS_STAGE_END - PRODUCTS_STAGE_START)
  );
}

async function fetchProductsCount(
  session: ShopifyGraphqlSession
): Promise<number | null> {
  try {
    const client = new shopify.api.clients.Graphql({ session });
    const response = await client.request(`
      query ProductScannerCount {
        productsCount {
          count
        }
      }
    `);
    const count = response?.data?.productsCount?.count;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

function addToTitleIndex(
  index: ProductCatalogIndex,
  productId: string,
  title: string
): void {
  const key = normalizeProductTitleKey(title || "");
  if (!key) return;

  const existing = index.titleIndex.get(key) || [];
  existing.push(productId);
  index.titleIndex.set(key, existing);

  if (!index.titleLabels.has(key)) {
    index.titleLabels.set(key, title.trim());
  }
}

/**
 * Product scanner:
 * Collect → Normalize → Run product rules (batched) → Save issues → Update counters.
 */
export async function runProductScanner(
  options: ProductScannerOptions
): Promise<ProductScannerResult> {
  const {
    scanId,
    session,
    shopDomain,
    pageSize = 50,
    maxProducts,
  } = options;

  await setScanProgress(scanId, "PRODUCTS", PRODUCTS_STAGE_START);

  const estimatedTotal =
    options.estimatedTotal ??
    (await fetchProductsCount(session));

  const titleIndex: ProductCatalogIndex = {
    titleIndex: new Map(),
    titleLabels: new Map(),
  };

  let productsProcessed = 0;
  let issuesSaved = 0;
  let rulesFailed = 0;
  let pageCount = 0;
  let truncated = false;
  const seoProducts: ProductSeoSnapshot[] = [];

  const collection = await collectProducts(session, {
    pageSize,
    mediaPageSize: 50,
    maxProducts,
    retainProducts: false,
    onPage: async (products, meta) => {
      pageCount = meta.pageNumber;

      for (const product of products) {
        addToTitleIndex(titleIndex, product.id, product.title);
        seoProducts.push({
          id: product.id,
          title: product.title,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
        });
      }

      // Run per-batch product rules on normalized data.
      const batchSummary = await runRules(
        PRODUCT_BATCH_RULES,
        { products },
        {
          context: {
            scanId,
            shopDomain,
            extras: {
              pageNumber: meta.pageNumber,
            },
          },
        }
      );

      rulesFailed += batchSummary.rulesFailed;
      const saved = await saveDetectedIssues(scanId, batchSummary.issues);
      issuesSaved += saved;

      productsProcessed += products.length;

      const percent = productsProgressPercent(
        productsProcessed,
        estimatedTotal
      );
      await setScanProgress(scanId, "PRODUCTS", percent);
    },
  });

  truncated = collection.truncated;
  pageCount = Math.max(pageCount, collection.pageCount);
  productsProcessed = Math.max(productsProcessed, collection.totalFetched);

  // Catalog-level duplicate title rule (after all batches).
  const duplicateSummary = await runRules(
    [duplicateTitleRule],
    titleIndex,
    {
      context: { scanId, shopDomain },
    }
  );
  rulesFailed += duplicateSummary.rulesFailed;
  issuesSaved += await saveDetectedIssues(scanId, duplicateSummary.issues);

  await setScanProgress(scanId, "PRODUCTS", PRODUCTS_STAGE_END);
  await syncProductScanCounters(scanId);

  return {
    productsProcessed,
    pageCount,
    truncated,
    issuesSaved,
    rulesFailed,
    seoProducts,
  };
}

/**
 * Recalculates deterministic scores from persisted issues and writes them to PostgreSQL.
 */
export async function syncProductScanCounters(scanId: string): Promise<void> {
  await recalculateAndPersistScanScores(scanId);
}
