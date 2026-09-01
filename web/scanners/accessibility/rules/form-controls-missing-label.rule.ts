import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  classificationToConfidence,
  type AccessibilityRulesData,
} from "../types.ts";

const RULE_ID = "a11y.form-controls-missing-label";

/**
 * Missing programmatic name = CONFIRMED when no label/aria/title.
 * Placeholder-only = POTENTIAL (placeholder is not a reliable accessible name).
 * Unresolved labelledby / possible wrapping label = MANUAL_REVIEW.
 */
export const formControlsMissingLabelRule: ScanRule<AccessibilityRulesData> = {
  id: RULE_ID,
  name: "Form controls without labels",
  category: "ACCESSIBILITY",
  defaultSeverity: "HIGH",
  description: "Detects form controls lacking an associated accessible name.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const snapshot of data.pages) {
      const pageUrl =
        snapshot.page.finalUrl || snapshot.page.requestedUrl;

      for (const control of snapshot.formControls) {
        if (control.hasLabelFor || (control.ariaLabel || "").trim()) {
          continue;
        }

        if (control.ariaLabelledBy) {
          issues.push({
            ruleId: RULE_ID,
            title: "Form control label needs review",
            description:
              "Control uses aria-labelledby; label text could not be resolved statically.",
            category: "ACCESSIBILITY",
            severity: "LOW",
            confidence: classificationToConfidence("MANUAL_REVIEW"),
            affectedResource: control.id || control.name || pageUrl,
            affectedResourceType: "form_control",
            recommendation:
              "Confirm aria-labelledby points to visible label text.",
            metadata: {
              classification: "MANUAL_REVIEW",
              pageKind: snapshot.page.kind,
              pageUrl,
              tagName: control.tagName,
              type: control.type,
              id: control.id,
              name: control.name,
              ariaLabelledBy: control.ariaLabelledBy,
              rawTagPreview: control.rawTagPreview,
              evidence: ["aria_labelledby_unresolved"],
            },
          });
          continue;
        }

        if ((control.title || "").trim()) {
          // title alone is weak; treat as potential
          issues.push({
            ruleId: RULE_ID,
            title: "Form control relies on title attribute",
            description:
              "Control appears to use only a title attribute for its name, which is often insufficient.",
            category: "ACCESSIBILITY",
            severity: "LOW",
            confidence: classificationToConfidence("POTENTIAL"),
            affectedResource: control.id || control.name || pageUrl,
            affectedResourceType: "form_control",
            recommendation:
              "Prefer a visible <label> or aria-label over title alone.",
            metadata: {
              classification: "POTENTIAL",
              pageKind: snapshot.page.kind,
              pageUrl,
              tagName: control.tagName,
              type: control.type,
              id: control.id,
              name: control.name,
              title: control.title,
              rawTagPreview: control.rawTagPreview,
              evidence: ["title_only"],
              note: "Not always a failure; verify with assistive technology.",
            },
          });
          continue;
        }

        if ((control.placeholder || "").trim()) {
          issues.push({
            ruleId: RULE_ID,
            title: "Form control may lack a proper label",
            description:
              "Control has a placeholder but no associated label was detected.",
            category: "ACCESSIBILITY",
            severity: "MEDIUM",
            confidence: classificationToConfidence("POTENTIAL"),
            affectedResource: control.id || control.name || pageUrl,
            affectedResourceType: "form_control",
            recommendation:
              "Add a visible label (or aria-label). Do not rely on placeholder alone.",
            metadata: {
              classification: "POTENTIAL",
              pageKind: snapshot.page.kind,
              pageUrl,
              tagName: control.tagName,
              type: control.type,
              id: control.id,
              name: control.name,
              placeholder: control.placeholder,
              rawTagPreview: control.rawTagPreview,
              evidence: ["placeholder_only", "no_label_for", "no_aria_label"],
              note: "Wrapping <label> elements are not fully detected statically.",
            },
          });
          continue;
        }

        issues.push({
          ruleId: RULE_ID,
          title: "Form control missing label",
          description: `A ${control.tagName} control on ${snapshot.page.kind} has no detected accessible name.`,
          category: "ACCESSIBILITY",
          severity: "HIGH",
          confidence: classificationToConfidence("CONFIRMED"),
          affectedResource: control.id || control.name || pageUrl,
          affectedResourceType: "form_control",
          recommendation:
            "Associate a <label for>, or provide aria-label / aria-labelledby.",
          metadata: {
            classification: "CONFIRMED",
            pageKind: snapshot.page.kind,
            pageUrl,
            tagName: control.tagName,
            type: control.type,
            id: control.id,
            name: control.name,
            rawTagPreview: control.rawTagPreview,
            evidence: [
              "no_label_for",
              "no_aria_label",
              "no_aria_labelledby",
              "no_title",
              "no_placeholder",
            ],
            note: "If the control is wrapped by a <label>, re-check manually.",
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
