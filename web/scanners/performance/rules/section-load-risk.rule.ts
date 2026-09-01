import type { DetectedIssue, IssueSeverity, ScanRule } from "../../../rules/types.ts";
import type { ExtractedSection, SectionPerformanceData } from "../types.ts";
import {
  MAX_SECTION_ISSUES_PER_PAGE,
  SECTION_WEIGHT_THRESHOLD,
} from "../types.ts";

const RULE_ID = "performance.section-load-risk";

function pageLabel(kind: string): string {
  switch (kind) {
    case "HOME":
      return "Homepage";
    case "PRODUCT":
      return "Product page";
    case "COLLECTION":
      return "Collection page";
    case "CART":
      return "Cart page";
    default:
      return kind;
  }
}

function severityForWeight(weight: number): IssueSeverity {
  if (weight >= 28) return "HIGH";
  if (weight >= 18) return "MEDIUM";
  return "LOW";
}

function buildWhy(section: ExtractedSection): string {
  if (section.offendingParts.length > 0) {
    return section.offendingParts
      .slice(0, 6)
      .map((p) => p.detail)
      .join(" | ");
  }

  const parts: string[] = [];
  if (section.imageCount > 0) {
    parts.push(
      `${section.imageCount} image(s)` +
        (section.imagesMissingLazy
          ? `, ${section.imagesMissingLazy} without lazy-loading`
          : "")
    );
  }
  if (section.scriptCount > 0) {
    parts.push(`${section.scriptCount} script(s) inside section`);
  }
  if (section.iframeCount > 0) {
    parts.push(`${section.iframeCount} iframe embed(s)`);
  }
  return parts.join("; ") || "Elevated estimated load weight.";
}

function buildRecommendation(section: ExtractedSection): string {
  const tips: string[] = [];
  const hasScript = section.scripts.some((s) => Boolean(s.src) || s.inline);
  const hasImageIssue =
    section.imagesMissingLazy > 0 || section.imageCount >= 4;

  if (hasScript) {
    const named = section.scripts
      .filter((s) => s.src)
      .slice(0, 3)
      .map((s) => s.src!.split("/").pop()?.split("?")[0] || s.src);
    tips.push(
      named.length
        ? `Review these scripts in section "${section.sectionType}": ${named.join(", ")}. Prefer defer/async or remove unused ones.`
        : `Remove unused inline scripts in section "${section.sectionType}" or load them with defer/async.`
    );
  }
  if (hasImageIssue) {
    tips.push(
      `In Theme Editor → section "${section.sectionType}", enable lazy-loading and compress images.`
    );
  }
  if (section.iframeSrcs.length > 0) {
    tips.push(
      `Defer embeds in "${section.sectionType}" (e.g. ${section.iframeSrcs[0]}) until user interaction.`
    );
  }
  if (section.htmlByteSize >= 20_000) {
    tips.push(
      `Simplify "${section.sectionType}" markup or split into smaller sections.`
    );
  }
  if (tips.length === 0) {
    tips.push(
      `Review section "${section.sectionType}" (${section.sectionDomId}) in Theme Editor and reduce heavy media/scripts.`
    );
  }
  return tips.join(" ");
}

/**
 * Flags storefront sections with high estimated load risk.
 */
export const sectionLoadRiskRule: ScanRule<SectionPerformanceData> = {
  id: RULE_ID,
  name: "Section likely slowing page load",
  category: "PERFORMANCE",
  defaultSeverity: "MEDIUM",
  description:
    "Estimates which Shopify theme sections are likely to slow page load and names the scripts/images/embeds involved.",

  evaluate(data) {
    const byPage = new Map<string, ExtractedSection[]>();
    for (const section of data.sections) {
      const key = `${section.pageKind}|${section.pageUrl}`;
      const list = byPage.get(key) || [];
      list.push(section);
      byPage.set(key, list);
    }

    const issues: DetectedIssue[] = [];

    for (const [, pageSections] of byPage) {
      const ranked = [...pageSections].sort(
        (a, b) => b.weightScore - a.weightScore
      );
      const candidates = ranked.filter(
        (s) => s.weightScore >= SECTION_WEIGHT_THRESHOLD
      );
      const selected = (
        candidates.length > 0
          ? candidates
          : ranked.slice(0, 1).filter((s) => s.weightScore >= 6)
      ).slice(0, MAX_SECTION_ISSUES_PER_PAGE);

      for (const section of selected) {
        const why = buildWhy(section);
        const scriptFiles = section.scripts
          .filter((s) => s.src)
          .map((s) => s.src as string);
        issues.push({
          ruleId: RULE_ID,
          title: `Section "${section.sectionType}" likely slowing ${pageLabel(section.pageKind).toLowerCase()}`,
          description:
            `${pageLabel(section.pageKind)} → section "${section.sectionType}" ` +
            `(#${section.sectionDomId}, risk ${section.weightScore}). ` +
            `Causing parts: ${why}`,
          category: "PERFORMANCE",
          severity: severityForWeight(section.weightScore),
          confidence: "MEDIUM",
          affectedResource: `${section.pageUrl}#${section.sectionDomId}`,
          affectedResourceType: "theme_section",
          recommendation: buildRecommendation(section),
          metadata: {
            issueGroup: "storefront",
            pageKind: section.pageKind,
            pageUrl: section.pageUrl,
            sectionDomId: section.sectionDomId,
            sectionId: section.sectionId,
            sectionType: section.sectionType,
            weightScore: section.weightScore,
            weightFactors: section.weightFactors,
            offendingParts: section.offendingParts,
            scriptFiles,
            inlineScriptCount: section.inlineScriptCount,
            iframeSrcs: section.iframeSrcs,
            imageCount: section.imageCount,
            imagesMissingLazy: section.imagesMissingLazy,
            iframeCount: section.iframeCount,
            videoCount: section.videoCount,
            scriptCount: section.scriptCount,
            htmlByteSize: section.htmlByteSize,
            approxNodeCount: section.approxNodeCount,
            measurement: "estimated",
          },
        });
      }
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
