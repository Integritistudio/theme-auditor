import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank } from "../types.ts";
import type { ProductBatchData } from "../types.ts";

const RULE_ID = "product.missing-seo-description";

/**
 * Flags products without an SEO description.
 */
export const missingSeoDescriptionRule: ScanRule<ProductBatchData> = {
  id: RULE_ID,
  name: "Missing SEO description",
  category: "SEO",
  defaultSeverity: "MEDIUM",
  description: "Detects products with an empty SEO description.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const product of data.products) {
      if (!isBlank(product.seoDescription)) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing SEO description",
        description: `"${product.title || product.id}" does not have an SEO description.`,
        category: "SEO",
        severity: "MEDIUM",
        confidence: "HIGH",
        affectedResource: product.id,
        affectedResourceType: "product",
        recommendation:
          "Add a concise SEO description summarizing the product benefits and keywords.",
        metadata: {
          productTitle: product.title,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
