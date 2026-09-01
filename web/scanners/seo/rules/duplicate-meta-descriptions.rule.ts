import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank, normalizeSeoText, type SeoRulesData } from "../types.ts";

const RULE_ID = "seo.duplicate-meta-descriptions";

export const duplicateMetaDescriptionsRule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Duplicate meta descriptions",
  category: "SEO",
  defaultSeverity: "MEDIUM",
  description:
    "Flags repeated meta descriptions across storefront pages and product SEO descriptions.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    const byMeta = new Map<string, typeof data.documents>();

    for (const doc of data.documents) {
      if (doc.source === "page" && !doc.scannable) continue;
      if (isBlank(doc.metaDescription)) continue;
      const key = normalizeSeoText(doc.metaDescription);
      if (!key) continue;
      const list = byMeta.get(key) || [];
      list.push(doc);
      byMeta.set(key, list);
    }

    for (const [key, docs] of byMeta.entries()) {
      if (docs.length < 2) continue;
      for (const doc of docs) {
        issues.push({
          ruleId: RULE_ID,
          title: "Duplicate meta description",
          description: `Meta description is shared by ${docs.length} resources.`,
          category: "SEO",
          severity: "MEDIUM",
          confidence: "HIGH",
          affectedResource: doc.url || doc.id,
          affectedResourceType: doc.source === "product" ? "product" : "page",
          recommendation: "Write a unique meta description for each page/product.",
          metadata: {
            metaDescription: doc.metaDescription,
            normalizedMetaDescription: key,
            duplicateCount: docs.length,
            duplicateIds: docs.map((d) => d.id),
            source: doc.source,
            pageKind: doc.kind,
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
