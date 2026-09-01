import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank } from "../types.ts";
import type { ProductBatchData } from "../types.ts";

const RULE_ID = "product.missing-seo-title";

/**
 * Flags products without an SEO title.
 */
export const missingSeoTitleRule: ScanRule<ProductBatchData> = {
  id: RULE_ID,
  name: "Missing SEO title",
  category: "SEO",
  defaultSeverity: "MEDIUM",
  description: "Detects products with an empty SEO title.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const product of data.products) {
      if (!isBlank(product.seoTitle)) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing SEO title",
        description: `"${product.title || product.id}" does not have an SEO title.`,
        category: "SEO",
        severity: "MEDIUM",
        confidence: "HIGH",
        affectedResource: product.id,
        affectedResourceType: "product",
        recommendation:
          "Set a unique SEO title that includes primary keywords and the product name.",
        metadata: {
          productTitle: product.title,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
