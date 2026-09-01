import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank } from "../types.ts";
import type { ProductBatchData } from "../types.ts";

const RULE_ID = "product.missing-product-type";

/**
 * Flags products without a product type.
 */
export const missingProductTypeRule: ScanRule<ProductBatchData> = {
  id: RULE_ID,
  name: "Missing product type",
  category: "PRODUCT",
  defaultSeverity: "LOW",
  description: "Detects products with an empty product type.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const product of data.products) {
      if (!isBlank(product.productType)) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing product type",
        description: `"${product.title || product.id}" does not have a product type.`,
        category: "PRODUCT",
        severity: "LOW",
        confidence: "HIGH",
        affectedResource: product.id,
        affectedResourceType: "product",
        recommendation:
          "Assign a product type to improve organization, filtering, and reporting.",
        metadata: {
          productTitle: product.title,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
