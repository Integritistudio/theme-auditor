import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { ThemeRulesData } from "../types.ts";

const RULE_ID = "theme.duplicate-external-script-url";

/**
 * Duplicate external script URLs (normalized) inside the SAME Liquid file.
 * Cross-file repeats are ignored — common and often intentional in Shopify themes.
 */
export const duplicateExternalScriptUrlRule: ScanRule<ThemeRulesData> = {
  id: RULE_ID,
  name: "Duplicate external script URL in one file",
  category: "SCRIPT",
  defaultSeverity: "HIGH",
  description:
    "Detects the same external script URL loaded more than once inside a single theme file.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    const byFileAndUrl = new Map<
      string,
      {
        sourceFile: string;
        normalizedUrl: string;
        srcs: string[];
        count: number;
      }
    >();

    for (const ref of data.theme.scriptReferences) {
      if (!ref.isExternal) continue;
      const key = `${ref.sourceFile}\0${ref.normalizedUrl}`;
      const entry = byFileAndUrl.get(key) || {
        sourceFile: ref.sourceFile,
        normalizedUrl: ref.normalizedUrl,
        srcs: [],
        count: 0,
      };
      entry.count += 1;
      entry.srcs.push(ref.src);
      byFileAndUrl.set(key, entry);
    }

    for (const entry of byFileAndUrl.values()) {
      if (entry.count < 2) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Duplicate external script in the same theme file",
        description:
          `External script "${entry.normalizedUrl}" is referenced ${entry.count} times in ` +
          `"${entry.sourceFile}".`,
        category: "SCRIPT",
        severity: "HIGH",
        confidence: "HIGH",
        affectedResource: entry.sourceFile,
        affectedResourceType: "theme_file",
        recommendation:
          `Keep a single include of "${entry.normalizedUrl}" in ${entry.sourceFile}.`,
        metadata: {
          issueGroup: "theme",
          normalizedUrl: entry.normalizedUrl,
          srcVariants: [...new Set(entry.srcs)],
          sourceFile: entry.sourceFile,
          occurrenceCount: entry.count,
          scope: "same_file",
          themeId: data.theme.themeId,
          sizeBytes: null,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
