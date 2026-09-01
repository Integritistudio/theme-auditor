import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  classificationToConfidence,
  type AccessibilityRulesData,
} from "../types.ts";

const RULE_ID = "a11y.empty-links";

/**
 * Links with no accessible name are CONFIRMED when name sources are all empty.
 */
export const emptyLinksRule: ScanRule<AccessibilityRulesData> = {
  id: RULE_ID,
  name: "Empty links",
  category: "ACCESSIBILITY",
  defaultSeverity: "HIGH",
  description: "Detects anchor elements with no discernible accessible name.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const snapshot of data.pages) {
      const pageUrl =
        snapshot.page.finalUrl || snapshot.page.requestedUrl;

      for (const link of snapshot.links) {
        if (!link.href && !link.accessibleName) {
          // Anchor used as button-like element with no href/name — still flag.
        }

        if (link.accessibleName.trim().length > 0) continue;
        if (link.ariaLabelledBy) {
          // Has labelledby reference we cannot resolve statically.
          issues.push({
            ruleId: RULE_ID,
            title: "Link accessible name needs review",
            description:
              "Link uses aria-labelledby; accessible name could not be resolved statically.",
            category: "ACCESSIBILITY",
            severity: "LOW",
            confidence: classificationToConfidence("MANUAL_REVIEW"),
            affectedResource: link.href || pageUrl,
            affectedResourceType: "link",
            recommendation:
              "Verify the aria-labelledby target provides a clear accessible name.",
            metadata: {
              classification: "MANUAL_REVIEW",
              pageKind: snapshot.page.kind,
              pageUrl,
              href: link.href,
              ariaLabelledBy: link.ariaLabelledBy,
              rawTagPreview: link.rawTagPreview,
              evidence: ["aria_labelledby_unresolved"],
            },
          });
          continue;
        }

        issues.push({
          ruleId: RULE_ID,
          title: "Empty link",
          description: `A link on ${snapshot.page.kind} has no accessible name.`,
          category: "ACCESSIBILITY",
          severity: "HIGH",
          confidence: classificationToConfidence("CONFIRMED"),
          affectedResource: link.href || pageUrl,
          affectedResourceType: "link",
          recommendation:
            "Provide link text, aria-label, or an image with meaningful alt text.",
          metadata: {
            classification: "CONFIRMED",
            pageKind: snapshot.page.kind,
            pageUrl,
            href: link.href,
            rawTagPreview: link.rawTagPreview,
            evidence: [
              "no_text",
              "no_aria_label",
              "no_title",
              "no_image_alt",
            ],
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
