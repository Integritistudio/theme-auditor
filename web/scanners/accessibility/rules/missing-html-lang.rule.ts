import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  classificationToConfidence,
  type AccessibilityRulesData,
} from "../types.ts";

const RULE_ID = "a11y.missing-html-lang";

export const missingHtmlLangRule: ScanRule<AccessibilityRulesData> = {
  id: RULE_ID,
  name: "Missing HTML lang attribute",
  category: "ACCESSIBILITY",
  defaultSeverity: "MEDIUM",
  description: "Detects pages whose <html> element has no lang attribute.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const snapshot of data.pages) {
      const pageUrl =
        snapshot.page.finalUrl || snapshot.page.requestedUrl;
      const lang = (snapshot.lang || "").trim();

      if (lang) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing HTML lang attribute",
        description: `${snapshot.page.kind} page <html> element has no lang attribute.`,
        category: "ACCESSIBILITY",
        severity: "MEDIUM",
        confidence: classificationToConfidence("CONFIRMED"),
        affectedResource: pageUrl,
        affectedResourceType: "page",
        recommendation: 'Add a lang attribute to <html>, e.g. lang="en".',
        metadata: {
          classification: "CONFIRMED",
          pageKind: snapshot.page.kind,
          pageUrl,
          evidence: ["html_lang_absent"],
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
