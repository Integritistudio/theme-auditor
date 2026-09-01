import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  classificationToConfidence,
  type AccessibilityRulesData,
} from "../types.ts";

const RULE_ID = "a11y.heading-hierarchy";

/**
 * Heading skips / odd starts are POTENTIAL, not guaranteed failures.
 * Complex outline issues are MANUAL_REVIEW.
 */
export const headingHierarchyRule: ScanRule<AccessibilityRulesData> = {
  id: RULE_ID,
  name: "Heading hierarchy problems",
  category: "ACCESSIBILITY",
  defaultSeverity: "LOW",
  description:
    "Flags possible heading level skips and unusual hierarchy patterns.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const snapshot of data.pages) {
      const pageUrl =
        snapshot.page.finalUrl || snapshot.page.requestedUrl;
      const levels = snapshot.headingLevels;

      if (levels.length === 0) {
        issues.push({
          ruleId: RULE_ID,
          title: "No headings found",
          description: `${snapshot.page.kind} page has no heading elements.`,
          category: "ACCESSIBILITY",
          severity: "LOW",
          confidence: classificationToConfidence("POTENTIAL"),
          affectedResource: pageUrl,
          affectedResourceType: "page",
          recommendation:
            "Ensure the page uses headings to convey structure when content warrants it.",
          metadata: {
            classification: "POTENTIAL",
            pageKind: snapshot.page.kind,
            pageUrl,
            headingLevels: levels,
            evidence: ["no_headings"],
            note: "Not always an error (sparse pages may not need headings).",
          },
        });
        continue;
      }

      const skips: Array<{ from: number; to: number }> = [];
      for (let i = 1; i < levels.length; i++) {
        const prev = levels[i - 1];
        const curr = levels[i];
        if (curr > prev + 1) {
          skips.push({ from: prev, to: curr });
        }
      }

      if (skips.length > 0) {
        issues.push({
          ruleId: RULE_ID,
          title: "Possible heading level skip",
          description: `${snapshot.page.kind} page may skip heading levels (${skips
            .map((s) => `h${s.from}→h${s.to}`)
            .join(", ")}).`,
          category: "ACCESSIBILITY",
          severity: "LOW",
          confidence: classificationToConfidence("POTENTIAL"),
          affectedResource: pageUrl,
          affectedResourceType: "page",
          recommendation:
            "Avoid skipping levels in the heading outline when possible (e.g. h2 before h4).",
          metadata: {
            classification: "POTENTIAL",
            pageKind: snapshot.page.kind,
            pageUrl,
            headingLevels: levels,
            skips,
            evidence: ["heading_level_skip"],
            note: "Skipped levels are often problematic but not an automatic WCAG failure in all contexts.",
          },
        });
      }

      if (levels[0] !== 1) {
        issues.push({
          ruleId: RULE_ID,
          title: "Heading outline does not start at H1",
          description: `${snapshot.page.kind} page first heading is h${levels[0]}.`,
          category: "ACCESSIBILITY",
          severity: "LOW",
          confidence: classificationToConfidence("MANUAL_REVIEW"),
          affectedResource: pageUrl,
          affectedResourceType: "page",
          recommendation:
            "Review whether the page should begin with an H1 for its primary topic.",
          metadata: {
            classification: "MANUAL_REVIEW",
            pageKind: snapshot.page.kind,
            pageUrl,
            headingLevels: levels,
            firstHeadingLevel: levels[0],
            evidence: ["first_heading_not_h1"],
            note: "Subjective / context-dependent; do not treat as a guaranteed error.",
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
