import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  classificationToConfidence,
  type AccessibilityRulesData,
} from "../types.ts";

const RULE_ID = "a11y.buttons-missing-name";

export const buttonsMissingNameRule: ScanRule<AccessibilityRulesData> = {
  id: RULE_ID,
  name: "Buttons without accessible names",
  category: "ACCESSIBILITY",
  defaultSeverity: "HIGH",
  description: "Detects buttons with no discernible accessible name.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const snapshot of data.pages) {
      const pageUrl =
        snapshot.page.finalUrl || snapshot.page.requestedUrl;

      for (const button of snapshot.buttons) {
        if (button.accessibleName.trim().length > 0) {
          if (button.ariaLabelledBy && button.accessibleName.startsWith("[labelledby:")) {
            issues.push({
              ruleId: RULE_ID,
              title: "Button accessible name needs review",
              description:
                "Button uses aria-labelledby; accessible name could not be resolved statically.",
              category: "ACCESSIBILITY",
              severity: "LOW",
              confidence: classificationToConfidence("MANUAL_REVIEW"),
              affectedResource: pageUrl,
              affectedResourceType: "button",
              recommendation:
                "Verify the aria-labelledby target provides a clear accessible name.",
              metadata: {
                classification: "MANUAL_REVIEW",
                pageKind: snapshot.page.kind,
                pageUrl,
                tagName: button.tagName,
                type: button.type,
                ariaLabelledBy: button.ariaLabelledBy,
                rawTagPreview: button.rawTagPreview,
                evidence: ["aria_labelledby_unresolved"],
              },
            });
          }
          continue;
        }

        issues.push({
          ruleId: RULE_ID,
          title: "Button missing accessible name",
          description: `A ${button.tagName} control on ${snapshot.page.kind} has no accessible name.`,
          category: "ACCESSIBILITY",
          severity: "HIGH",
          confidence: classificationToConfidence("CONFIRMED"),
          affectedResource: pageUrl,
          affectedResourceType: "button",
          recommendation:
            "Provide visible text, aria-label, or aria-labelledby for the button.",
          metadata: {
            classification: "CONFIRMED",
            pageKind: snapshot.page.kind,
            pageUrl,
            tagName: button.tagName,
            type: button.type,
            rawTagPreview: button.rawTagPreview,
            evidence: ["no_text", "no_aria_label", "no_title", "no_value"],
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
