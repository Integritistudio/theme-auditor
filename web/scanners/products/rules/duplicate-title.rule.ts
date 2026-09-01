import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { ProductCatalogIndex } from "../types.ts";

const RULE_ID = "product.duplicate-title";

/**
 * Flags products that share the same title with at least one other product.
 * Uses a catalog-wide title index built during batch collection.
 */
export const duplicateTitleRule: ScanRule<ProductCatalogIndex> = {
  id: RULE_ID,
  name: "Duplicate product title",
  category: "PRODUCT",
  defaultSeverity: "MEDIUM",
  description: "Detects multiple products that share the same title.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const [key, productIds] of data.titleIndex.entries()) {
      if (productIds.length < 2) continue;

      const label = data.titleLabels.get(key) || key;

      for (const productId of productIds) {
        issues.push({
          ruleId: RULE_ID,
          title: "Duplicate product title",
          description: `Product title "${label}" is used by ${productIds.length} products.`,
          category: "PRODUCT",
          severity: "MEDIUM",
          confidence: "HIGH",
          affectedResource: productId,
          affectedResourceType: "product",
          recommendation:
            "Give each product a unique title to avoid buyer and SEO confusion.",
          metadata: {
            title: label,
            duplicateCount: productIds.length,
            duplicateProductIds: productIds,
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
