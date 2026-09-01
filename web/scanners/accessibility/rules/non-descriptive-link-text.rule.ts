import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { NON_DESCRIPTIVE_LINK_TEXTS } from "../extract.ts";
import {
  classificationToConfidence,
  type AccessibilityRulesData,
} from "../types.ts";

const RULE_ID = "a11y.non-descriptive-link-text";

/**
 * Generic link phrases are POTENTIAL findings — not guaranteed errors.
 */
export const nonDescriptiveLinkTextRule: ScanRule<AccessibilityRulesData> = {
  id: RULE_ID,
  name: "Links without meaningful accessible text",
  category: "ACCESSIBILITY",
  defaultSeverity: "LOW",
  description:
    "Flags generic link names that may be unclear out of context (potential issues).",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const snapshot of data.pages) {
      const pageUrl =
        snapshot.page.finalUrl || snapshot.page.requestedUrl;

      for (const link of snapshot.links) {
        const name = link.accessibleName.trim().toLowerCase();
        if (!name || name.startsWith("[labelledby:")) continue;
        if (name === "[image-alt]") continue;

        if (!NON_DESCRIPTIVE_LINK_TEXTS.has(name)) continue;

        issues.push({
          ruleId: RULE_ID,
          title: "Link text may not be meaningful",
          description: `Link accessible name "${link.accessibleName}" may be unclear out of context.`,
          category: "ACCESSIBILITY",
          severity: "LOW",
          confidence: classificationToConfidence("POTENTIAL"),
          affectedResource: link.href || pageUrl,
          affectedResourceType: "link",
          recommendation:
            "Prefer descriptive link text that makes sense alone (e.g. product or action name).",
          metadata: {
            classification: "POTENTIAL",
            pageKind: snapshot.page.kind,
            pageUrl,
            href: link.href,
            accessibleName: link.accessibleName,
            rawTagPreview: link.rawTagPreview,
            evidence: ["generic_link_phrase"],
            note: "Not a guaranteed WCAG failure; review in page context.",
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
