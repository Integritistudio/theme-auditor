import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  LARGE_JS_BYTES,
  formatBytes,
  type ThemeRulesData,
} from "../types.ts";

const RULE_ID = "theme.large-javascript";

export const largeJavascriptRule: ScanRule<ThemeRulesData> = {
  id: RULE_ID,
  name: "Large JavaScript assets",
  category: "PERFORMANCE",
  defaultSeverity: "MEDIUM",
  description: `Flags theme JavaScript assets larger than ${LARGE_JS_BYTES} bytes.`,

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const asset of data.theme.assets) {
      if (asset.kind !== "javascript") continue;
      if (asset.sizeBytes === null || asset.sizeBytes <= LARGE_JS_BYTES) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Large JavaScript asset",
        description: `${asset.filename} is ${formatBytes(asset.sizeBytes)} (${asset.sizeBytes} bytes), which may slow storefront load.`,
        category: "PERFORMANCE",
        severity: asset.sizeBytes > LARGE_JS_BYTES * 2 ? "HIGH" : "MEDIUM",
        confidence: "HIGH",
        affectedResource: asset.filename,
        affectedResourceType: "theme_asset",
        recommendation:
          "Split, defer, or minify large JavaScript bundles and remove unused code where proven safe.",
        metadata: {
          filename: asset.filename,
          sizeBytes: asset.sizeBytes,
          sizeLabel: formatBytes(asset.sizeBytes),
          thresholdBytes: LARGE_JS_BYTES,
          contentType: asset.contentType,
          checksumMd5: asset.checksumMd5,
          themeId: data.theme.themeId,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
