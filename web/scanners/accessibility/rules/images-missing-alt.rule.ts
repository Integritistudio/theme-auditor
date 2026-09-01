import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  classificationToConfidence,
  type AccessibilityRulesData,
} from "../types.ts";

const RULE_ID = "a11y.images-missing-alt";

/**
 * Images missing an alt attribute are CONFIRMED.
 * Empty alt="" is MANUAL_REVIEW (may be decorative).
 */
export const imagesMissingAltRule: ScanRule<AccessibilityRulesData> = {
  id: RULE_ID,
  name: "Images without alt attributes",
  category: "ACCESSIBILITY",
  defaultSeverity: "MEDIUM",
  description:
    "Detects images missing alt attributes; empty alt values need manual review.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const snapshot of data.pages) {
      const pageUrl =
        snapshot.page.finalUrl || snapshot.page.requestedUrl;

      for (const image of snapshot.images) {
        if (image.ariaHidden) continue;

        if (!image.altAttributePresent) {
          issues.push({
            ruleId: RULE_ID,
            title: "Image missing alt attribute",
            description: `An image on ${snapshot.page.kind} is missing an alt attribute.`,
            category: "ACCESSIBILITY",
            severity: "HIGH",
            confidence: classificationToConfidence("CONFIRMED"),
            affectedResource: image.src || pageUrl,
            affectedResourceType: "image",
            recommendation:
              "Add an alt attribute. Use meaningful text for informative images, or alt=\"\" only when decorative.",
            metadata: {
              classification: "CONFIRMED",
              pageKind: snapshot.page.kind,
              pageUrl,
              src: image.src,
              evidence: ["alt_attribute_absent"],
            },
          });
          continue;
        }

        if ((image.altValue || "").trim() === "") {
          issues.push({
            ruleId: RULE_ID,
            title: "Image has empty alt text",
            description: `An image on ${snapshot.page.kind} has alt=\"\". Confirm it is decorative.`,
            category: "ACCESSIBILITY",
            severity: "LOW",
            confidence: classificationToConfidence("MANUAL_REVIEW"),
            affectedResource: image.src || pageUrl,
            affectedResourceType: "image",
            recommendation:
              "Keep empty alt only for decorative images; otherwise provide descriptive alt text.",
            metadata: {
              classification: "MANUAL_REVIEW",
              pageKind: snapshot.page.kind,
              pageUrl,
              src: image.src,
              evidence: ["alt_attribute_empty"],
              note: "Empty alt may be intentional for decorative images.",
            },
          });
        }
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
