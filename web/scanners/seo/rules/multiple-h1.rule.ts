import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { SeoRulesData } from "../types.ts";

const RULE_ID = "seo.multiple-h1";

export const multipleH1Rule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Multiple H1 elements",
  category: "SEO",
  defaultSeverity: "LOW",
  description: "Flags storefront pages that contain more than one H1.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    for (const doc of data.documents) {
      if (doc.source !== "page" || !doc.scannable) continue;
      if (doc.h1Texts.length <= 1) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Multiple H1 elements",
        description: `${doc.kind} page has ${doc.h1Texts.length} H1 headings.`,
        category: "SEO",
        severity: "LOW",
        confidence: "HIGH",
        affectedResource: doc.url || doc.id,
        affectedResourceType: "page",
        recommendation: "Keep a single primary H1 and demote additional headings to H2+.",
        metadata: {
          pageKind: doc.kind,
          url: doc.url,
          h1Count: doc.h1Texts.length,
          h1Texts: doc.h1Texts,
        },
      });
    }
    return { ruleId: RULE_ID, ok: true, issues };
  },
};
