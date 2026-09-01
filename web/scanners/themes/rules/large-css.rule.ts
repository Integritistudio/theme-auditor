import type { DetectedIssue, ScanRule } from "../../../rules/types.ts";
import {
  LARGE_CSS_BYTES,
  formatBytes,
  type ThemeRulesData,
} from "../types.ts";

const RULE_ID = "theme.large-css";

export const largeCssRule: ScanRule<ThemeRulesData> = {
  id: RULE_ID,
  name: "Large CSS assets",
  category: "PERFORMANCE",
  defaultSeverity: "MEDIUM",
  description: `Flags theme CSS assets larger than ${LARGE_CSS_BYTES} bytes.`,

  evaluate(data) {
    const issues: DetectedIssue[] = [];

    for (const asset of data.theme.assets) {
      if (asset.kind !== "css") continue;
      if (asset.sizeBytes === null || asset.sizeBytes <= LARGE_CSS_BYTES) continue;

      issues.push({
        ruleId: RULE_ID,
        title: "Large CSS asset",
        description: `${asset.filename} is ${formatBytes(asset.sizeBytes)} (${asset.sizeBytes} bytes), which may delay rendering.`,
        category: "PERFORMANCE",
        severity: asset.sizeBytes > LARGE_CSS_BYTES * 2 ? "HIGH" : "MEDIUM",
        confidence: "HIGH",
        affectedResource: asset.filename,
        affectedResourceType: "theme_asset",
        recommendation:
          "Reduce CSS size by removing unused styles (only when verified) and splitting critical vs non-critical CSS.",
        metadata: {
          filename: asset.filename,
          sizeBytes: asset.sizeBytes,
          sizeLabel: formatBytes(asset.sizeBytes),
          thresholdBytes: LARGE_CSS_BYTES,
          contentType: asset.contentType,
          checksumMd5: asset.checksumMd5,
          themeId: data.theme.themeId,
        },
      });
    }

    return { ruleId: RULE_ID, ok: true, issues };
  },
};
