import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { ThemeRulesData } from "../types.ts";

const RULE_ID = "theme.duplicate-script-reference";

/**
 * Exact duplicate script src strings repeated inside the SAME Liquid file.
 * Cross-file repeats are ignored here — sections/templates often share includes
 * without loading together. Live double-loads are checked on storefront HTML.
 */
export const duplicateScriptReferenceRule: ScanRule<ThemeRulesData> = {
  id: RULE_ID,
  name: "Exact duplicate script references in one file",
  category: "SCRIPT",
  defaultSeverity: "HIGH",
  description:
    "Detects identical script src values repeated inside a single theme Liquid file.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];
    // key: sourceFile + \0 + exact src
    const byFileAndSrc = new Map<
      string,
      { sourceFile: string; src: string; rawTags: string[]; count: number }
    >();

    for (const ref of data.theme.scriptReferences) {
      const key = `${ref.sourceFile}\0${ref.src}`;
      const entry = byFileAndSrc.get(key) || {
        sourceFile: ref.sourceFile,
        src: ref.src,
        rawTags: [],
        count: 0,
      };
      entry.count += 1;
      entry.rawTags.push(ref.rawTag);
      byFileAndSrc.set(key, entry);
    }

    for (const entry of byFileAndSrc.values()) {
      if (entry.count < 2) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Duplicate script in the same theme file",
        description:
          `Script src "${entry.src}" appears ${entry.count} times in ` +
          `"${entry.sourceFile}". Same-file duplicates usually load twice on pages that include this file.`,
        category: "SCRIPT",
        severity: "HIGH",
        confidence: "HIGH",
        affectedResource: entry.sourceFile,
        affectedResourceType: "theme_file",
        recommendation:
          `Remove the extra <script> tags for "${entry.src}" in ${entry.sourceFile} so it is included only once in that file.`,
        metadata: {
          issueGroup: "theme",
          src: entry.src,
          sourceFile: entry.sourceFile,
          occurrenceCount: entry.count,
          rawTags: entry.rawTags,
          scope: "same_file",
          themeId: data.theme.themeId,
          sizeBytes: null,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
