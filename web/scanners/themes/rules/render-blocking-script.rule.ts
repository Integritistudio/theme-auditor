import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import type { ThemeRulesData } from "../types.ts";

const RULE_ID = "theme.render-blocking-script";

/**
 * Flags sync classic scripts in layout <head> as potentially render-blocking.
 * Requires sufficient structural evidence; does not claim unused scripts.
 */
export const renderBlockingScriptRule: ScanRule<ThemeRulesData> = {
  id: RULE_ID,
  name: "Potentially render-blocking scripts",
  category: "PERFORMANCE",
  defaultSeverity: "MEDIUM",
  description:
    "Flags classic (non-module) scripts in layout <head> without async/defer.",

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const ref of data.theme.scriptReferences) {
      // Sufficient evidence gate:
      // - layout file
      // - inside <head>
      // - has src
      // - not async/defer
      // - not type=module (deferred by default)
      const inLayout = ref.sourceFile.toLowerCase().startsWith("layout/");
      if (!inLayout || !ref.inHead) continue;
      if (ref.async || ref.defer || ref.isModule) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Script may block rendering",
        description: `Sync script "${ref.src}" in ${ref.sourceFile} <head> may block rendering (no async/defer; not type=module).`,
        category: "PERFORMANCE",
        severity: "MEDIUM",
        confidence: "MEDIUM",
        affectedResource: ref.src,
        affectedResourceType: "script",
        recommendation:
          "Add defer/async when safe, move non-critical scripts later, or convert to type=module if appropriate.",
        metadata: {
          src: ref.src,
          normalizedUrl: ref.normalizedUrl,
          sourceFile: ref.sourceFile,
          inHead: ref.inHead,
          async: ref.async,
          defer: ref.defer,
          type: ref.type,
          isModule: ref.isModule,
          isExternal: ref.isExternal,
          isShopifyHosted: ref.isShopifyHosted,
          rawTag: ref.rawTag,
          evidence: [
            "found_in_layout_head",
            "classic_script_without_async_or_defer",
          ],
          sizeBytes: null,
          themeId: data.theme.themeId,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
