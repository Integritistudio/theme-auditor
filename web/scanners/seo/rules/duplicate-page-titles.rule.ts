import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { isBlank, normalizeSeoText, type SeoRulesData } from "../types.ts";

const RULE_ID = "seo.duplicate-page-titles";

/**
 * Detects duplicate titles across scannable pages and product SEO titles.
 */
export const duplicatePageTitlesRule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Duplicate page titles",
  category: "SEO",
  defaultSeverity: "MEDIUM",
  description: "Flags repeated titles across storefront pages and product SEO titles.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    const byTitle = new Map<string, typeof data.documents>();

    for (const doc of data.documents) {
      // Include scannable pages + product admin SEO titles.
      if (doc.source === "page" && !doc.scannable) continue;
      if (isBlank(doc.title)) continue;
      const key = normalizeSeoText(doc.title);
      if (!key) continue;
      const list = byTitle.get(key) || [];
      list.push(doc);
      byTitle.set(key, list);
    }

    for (const [key, docs] of byTitle.entries()) {
      if (docs.length < 2) continue;
      for (const doc of docs) {
        issues.push({
          ruleId: RULE_ID,
          title: "Duplicate page title",
          description: `Title "${doc.title}" is shared by ${docs.length} resources.`,
          category: "SEO",
          severity: "MEDIUM",
          confidence: "HIGH",
          affectedResource: doc.url || doc.id,
          affectedResourceType: doc.source === "product" ? "product" : "page",
          recommendation: "Give each page/product a unique SEO title.",
          metadata: {
            title: doc.title,
            normalizedTitle: key,
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
