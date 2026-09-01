import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  SHORT_DESCRIPTION_THRESHOLD,
  isBlank,
  type ProductBatchData,
} from "../types.ts";

const RULE_ID = "product.short-description";

/**
 * Flags products with an empty or very short description.
 */
export const shortDescriptionRule: ScanRule<ProductBatchData> = {
  id: RULE_ID,
  name: "Very short or empty product description",
  category: "PRODUCT",
  defaultSeverity: "MEDIUM",
  description: `Detects product descriptions shorter than ${SHORT_DESCRIPTION_THRESHOLD} characters.`,

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const product of data.products) {
      const description = product.description?.trim() || "";
      if (!isBlank(description) && description.length >= SHORT_DESCRIPTION_THRESHOLD) {
        continue;
      }

      const empty = isBlank(description);
      issues.push({
        ruleId: RULE_ID,
        title: empty
          ? "Empty product description"
          : "Very short product description",
        description: empty
          ? `"${product.title || product.id}" has no product description.`
          : `"${product.title || product.id}" has a description of only ${description.length} characters.`,
        category: "PRODUCT",
        severity: empty ? "HIGH" : "MEDIUM",
        confidence: "HIGH",
        affectedResource: product.id,
        affectedResourceType: "product",
        recommendation: `Write a clear product description of at least ${SHORT_DESCRIPTION_THRESHOLD} characters.`,
        metadata: {
          productTitle: product.title,
          descriptionLength: description.length,
          threshold: SHORT_DESCRIPTION_THRESHOLD,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
