import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  EXCESSIVE_THIRD_PARTY_SCRIPT_COUNT,
  type ThemeRulesData,
} from "../types.ts";

const RULE_ID = "theme.excessive-third-party-scripts";

/**
 * Flags an excessive count of unique third-party (non-Shopify) external scripts.
 */
export const excessiveThirdPartyScriptsRule: ScanRule<ThemeRulesData> = {
  id: RULE_ID,
  name: "Excessive third-party scripts",
  category: "PERFORMANCE",
  defaultSeverity: "HIGH",
  description: `Flags when unique third-party script URLs exceed ${EXCESSIVE_THIRD_PARTY_SCRIPT_COUNT}.`,

  evaluate(data) {
    const thirdParty = new Map<string, { srcs: string[]; sourceFiles: string[] }>();

    for (const ref of data.theme.scriptReferences) {
      if (!ref.isExternal || ref.isShopifyHosted) continue;
      const entry = thirdParty.get(ref.normalizedUrl) || {
        srcs: [],
        sourceFiles: [],
      };
      entry.srcs.push(ref.src);
      entry.sourceFiles.push(ref.sourceFile);
      thirdParty.set(ref.normalizedUrl, entry);
    }

    const count = thirdParty.size;
    if (count <= EXCESSIVE_THIRD_PARTY_SCRIPT_COUNT) {
      return { ruleId: RULE_ID, ok: true, issues: [] };
    }

    const scripts = [...thirdParty.entries()].map(([normalizedUrl, entry]) => ({
      normalizedUrl,
      srcs: [...new Set(entry.srcs)],
      sourceFiles: [...new Set(entry.sourceFiles)],
    }));

    const issue: DetectedIssue = {
      ruleId: RULE_ID,
      title: "Excessive third-party scripts",
      description: `Theme references ${count} unique third-party scripts (threshold ${EXCESSIVE_THIRD_PARTY_SCRIPT_COUNT}).`,
      category: "PERFORMANCE",
      severity: count >= EXCESSIVE_THIRD_PARTY_SCRIPT_COUNT * 2 ? "CRITICAL" : "HIGH",
      confidence: "HIGH",
      affectedResource: data.theme.themeId,
      affectedResourceType: "theme",
      recommendation:
        "Audit each third-party script for necessity, load non-critical tags later, and remove confirmed duplicates.",
      metadata: {
        thirdPartyCount: count,
        threshold: EXCESSIVE_THIRD_PARTY_SCRIPT_COUNT,
        scripts,
        themeId: data.theme.themeId,
        themeName: data.theme.themeName,
        sizeBytes: null,
      },
    };

    return { ruleId: RULE_ID, ok: true, issues: [issue] };
  },
};
