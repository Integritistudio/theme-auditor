import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { ProductBatchData } from "../types.ts";

const RULE_ID = "product.no-images";

/**
 * Flags products that have zero images.
 */
export const noImagesRule: ScanRule<ProductBatchData> = {
  id: RULE_ID,
  name: "Product has no images",
  category: "PRODUCT",
  defaultSeverity: "HIGH",
  description: "Detects products with an empty image gallery.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const product of data.products) {
      if (product.images.length > 0) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Product has no images",
        description: `"${product.title || product.id}" does not have any product images.`,
        category: "PRODUCT",
        severity: "HIGH",
        confidence: "HIGH",
        affectedResource: product.id,
        affectedResourceType: "product",
        recommendation: "Add at least one high-quality product image.",
        metadata: {
          productTitle: product.title,
          status: product.status,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
