import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank, type SeoRulesData } from "../types.ts";

const RULE_ID = "seo.missing-page-title";

export const missingPageTitleRule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Missing page title",
  category: "SEO",
  defaultSeverity: "HIGH",
  description: "Flags successfully fetched storefront pages with an empty <title>.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    for (const doc of data.documents) {
      if (doc.source !== "page" || !doc.scannable) continue;
      if (!isBlank(doc.title)) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing page title",
        description: `${doc.kind} page is missing a title tag.`,
        category: "SEO",
        severity: "HIGH",
        confidence: "HIGH",
        affectedResource: doc.url || doc.id,
        affectedResourceType: "page",
        recommendation: "Add a unique, descriptive <title> for this page.",
        metadata: {
          pageKind: doc.kind,
          url: doc.url,
          source: doc.source,
        },
      });
    }
    return { ruleId: RULE_ID, ok: true, issues };
  },
};
