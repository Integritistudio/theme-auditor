import type { DetectedIssue, ScanRule } from "../types.ts";

/**
 * Minimal scanner data shape for the example image rule.
 * Real image scanners can replace this with richer payloads later.
 */
export interface ExampleImageScanData {
  images: Array<{
    id: string;
    src?: string;
    alt?: string | null;
  }>;
}

const RULE_ID = "image.missing-alt";

/**
 * Example rule: flags images missing meaningful alt text.
 * Demonstrates an independent rule scanners can register with the runner.
 */
export const missingImageAltRule: ScanRule<ExampleImageScanData> = {
  id: RULE_ID,
  name: "Missing image alt text",
  category: "ACCESSIBILITY",
  defaultSeverity: "MEDIUM",
  description:
    "Detects store images that have empty or missing alternative text.",

  evaluate(data) {
    const images = Array.isArray(data?.images) ? data.images : [];
    const issues: DetectedIssue[] = [];

    for (const image of images) {
      const alt = image.alt?.trim() ?? "";
      if (alt.length > 0) {
        continue;
      }

      issues.push({
        ruleId: RULE_ID,
        title: "Image is missing alt text",
        description:
          "An image has empty or missing alternative text, which hurts accessibility and SEO.",
        category: "ACCESSIBILITY",
        severity: "MEDIUM",
        confidence: "HIGH",
        affectedResource: image.id,
        affectedResourceType: "image",
        recommendation:
          "Add concise, descriptive alt text that conveys the image purpose.",
        metadata: {
          src: image.src ?? null,
        },
      });
    }

    return {
      ruleId: RULE_ID,
      ok: true,
      issues,
    };
  },
};
