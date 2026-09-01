import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank } from "../types.ts";
import type { ProductBatchData } from "../types.ts";

const RULE_ID = "product.images-missing-alt";

/**
 * Flags product images that are missing alt text.
 * Emits one issue per image so each asset can be fixed independently.
 */
export const imagesMissingAltRule: ScanRule<ProductBatchData> = {
  id: RULE_ID,
  name: "Product images missing alt text",
  category: "ACCESSIBILITY",
  defaultSeverity: "MEDIUM",
  description: "Detects product images with empty or missing alternative text.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const product of data.products) {
      for (const image of product.images) {
        if (!isBlank(image.altText)) continue;

        issues.push({
          ruleId: RULE_ID,
          title: "Product image missing alt text",
          description: `An image on "${product.title || product.id}" has empty or missing alt text.`,
          category: "ACCESSIBILITY",
          severity: "MEDIUM",
          confidence: "HIGH",
          affectedResource: image.id,
          affectedResourceType: "image",
          recommendation:
            "Add concise alt text that describes the image for accessibility and SEO.",
          metadata: {
            productId: product.id,
            productTitle: product.title,
            imageUrl: image.url,
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
