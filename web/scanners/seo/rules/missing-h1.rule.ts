import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { SeoRulesData } from "../types.ts";

const RULE_ID = "seo.missing-h1";

export const missingH1Rule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Missing H1",
  category: "SEO",
  defaultSeverity: "MEDIUM",
  description: "Flags storefront pages with no H1 heading.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    for (const doc of data.documents) {
      if (doc.source !== "page" || !doc.scannable) continue;
      if (doc.h1Texts.length > 0) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing H1",
        description: `${doc.kind} page has no H1 heading.`,
        category: "SEO",
        severity: "MEDIUM",
        confidence: "HIGH",
        affectedResource: doc.url || doc.id,
        affectedResourceType: "page",
        recommendation: "Include a single clear H1 that describes the page topic.",
        metadata: {
          pageKind: doc.kind,
          url: doc.url,
          h1Count: 0,
        },
      });
    }
    return { ruleId: RULE_ID, ok: true, issues };
  },
};
