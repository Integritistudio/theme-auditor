import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank, type SeoRulesData } from "../types.ts";

const RULE_ID = "seo.missing-canonical";

export const missingCanonicalRule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Missing canonical URL",
  category: "SEO",
  defaultSeverity: "MEDIUM",
  description: "Flags storefront pages without a rel=canonical link.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    for (const doc of data.documents) {
      if (doc.source !== "page" || !doc.scannable) continue;
      if (!isBlank(doc.canonicalUrl)) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing canonical URL",
        description: `${doc.kind} page is missing a canonical URL.`,
        category: "SEO",
        severity: "MEDIUM",
        confidence: "HIGH",
        affectedResource: doc.url || doc.id,
        affectedResourceType: "page",
        recommendation: "Add a rel=canonical link pointing to the preferred page URL.",
        metadata: {
          pageKind: doc.kind,
          url: doc.url,
        },
      });
    }
    return { ruleId: RULE_ID, ok: true, issues };
  },
};
