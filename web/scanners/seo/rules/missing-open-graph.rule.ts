import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import { OG_RELEVANT_KINDS, isBlank, type SeoRulesData } from "../types.ts";
import type { PageKind } from "../../../collectors/storefront/types.ts";

const RULE_ID = "seo.missing-open-graph";

/**
 * Flags HOME/PRODUCT/COLLECTION pages missing core Open Graph tags.
 * Cart pages are excluded (not typically shared).
 */
export const missingOpenGraphRule: ScanRule<SeoRulesData> = {
  id: RULE_ID,
  name: "Missing Open Graph information",
  category: "SEO",
  defaultSeverity: "LOW",
  description:
    "Flags marketing-relevant pages missing og:title, og:description, or og:image.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const doc of data.documents) {
      if (doc.source !== "page" || !doc.scannable) continue;
      if (!OG_RELEVANT_KINDS.has(doc.kind as PageKind)) continue;

      const og = doc.openGraph;
      const missing: string[] = [];
      if (!og || isBlank(og.title)) missing.push("og:title");
      if (!og || isBlank(og.description)) missing.push("og:description");
      if (!og || isBlank(og.image)) missing.push("og:image");

      if (missing.length === 0) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Missing Open Graph information",
        description: `${doc.kind} page is missing Open Graph tags: ${missing.join(", ")}.`,
        category: "SEO",
        severity: missing.length >= 2 ? "MEDIUM" : "LOW",
        confidence: "HIGH",
        affectedResource: doc.url || doc.id,
        affectedResourceType: "page",
        recommendation:
          "Add og:title, og:description, and og:image for better social sharing previews.",
        metadata: {
          pageKind: doc.kind,
          url: doc.url,
          missingTags: missing,
          openGraph: og,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
