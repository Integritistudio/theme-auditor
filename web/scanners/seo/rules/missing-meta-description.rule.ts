import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank, type SeoRulesData } from "../types.ts";

const RULE_ID = "seo.missing-meta-description";

export const missingMetaDescriptionRule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Missing meta description",
  category: "SEO",
  defaultSeverity: "MEDIUM",
  description: "Flags storefront pages missing a meta name=description tag.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    for (const doc of data.documents) {
      if (doc.source !== "page" || !doc.scannable) continue;
      if (!isBlank(doc.metaDescription)) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing meta description",
        description: `${doc.kind} page is missing a meta description.`,
        category: "SEO",
        severity: "MEDIUM",
        confidence: "HIGH",
        affectedResource: doc.url || doc.id,
        affectedResourceType: "page",
        recommendation: "Add a concise meta description summarizing the page content.",
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
