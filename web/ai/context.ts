import {
  getIssueCountsByScan,
  getTopPriorityIssues,
  type Issue,
} from "../db/repositories/issues.repository.ts";
import { getScanById } from "../db/repositories/scans.repository.ts";
import { aiEnv } from "./env.ts";
import {
  AiAnalysisContextSchema,
  type AiAnalysisContext,
  type AiIssueSnapshot,
} from "./schemas.ts";

function toIssueSnapshot(issue: Issue): AiIssueSnapshot {
  return {
    id: issue.id,
    ruleId: issue.rule_id,
    category: issue.category,
    title: issue.title,
    description: issue.description,
    severity: issue.severity,
    impactScore: issue.impact_score ?? 0,
    confidenceScore: issue.confidence_score ?? 0,
    affectedResource: issue.affected_resource,
    affectedResourceType: issue.affected_resource_type,
    recommendation: issue.recommendation,
    metadata: sanitizeMetadata(issue.metadata),
  };
}

/**
 * Keep metadata small and technical — never invent fields beyond rule output.
 */
function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const allowedKeys = [
    "classification",
    "evidence",
    "pageType",
    "pageUrl",
    "selector",
    "fileKey",
    "scriptUrl",
    "duplicateOf",
    "count",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in metadata) {
      const value = metadata[key];
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        out[key] = value;
      } else if (Array.isArray(value)) {
        out[key] = value.slice(0, 10);
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function highestSeverity(
  issues: Issue[]
): "critical" | "high" | "medium" | "low" | "none" {
  const order = ["critical", "high", "medium", "low"] as const;
  for (const severity of order) {
    if (issues.some((issue) => issue.severity === severity)) {
      return severity;
    }
  }
  return "none";
}

/**
 * Builds the AI input payload exclusively from persisted rule-engine data.
 */
export async function buildAiAnalysisContext(options: {
  scanId: string;
  shopDomain?: string;
}): Promise<AiAnalysisContext> {
  const scan = await getScanById(options.scanId);
  if (!scan) {
    throw new Error(`Scan not found: ${options.scanId}`);
  }

  const [issueCounts, highPriorityIssues] = await Promise.all([
    getIssueCountsByScan(options.scanId),
    getTopPriorityIssues(options.scanId, aiEnv.AI_MAX_HIGH_PRIORITY_ISSUES),
  ]);

  const snapshots = highPriorityIssues.map(toIssueSnapshot);
  const uniqueRuleIds = [...new Set(snapshots.map((i) => i.ruleId))].sort();
  const categoriesPresent = [
    ...new Set(snapshots.map((i) => i.category)),
  ].sort();
  const affectedResourceTypes = [
    ...new Set(
      snapshots
        .map((i) => i.affectedResourceType)
        .filter((v): v is string => Boolean(v))
    ),
  ].sort();

  const context = {
    scanId: scan.id,
    shopDomain: options.shopDomain,
    storeHealthScore: scan.overall_score ?? 0,
    categoryScores: {
      performance: scan.performance_score ?? 0,
      seo: scan.seo_score ?? 0,
      accessibility: scan.accessibility_score ?? 0,
      theme: scan.theme_score ?? 0,
      product: scan.product_score ?? 0,
    },
    issueCounts,
    highPriorityIssues: snapshots,
    technicalMetadata: {
      uniqueRuleIds,
      categoriesPresent,
      affectedResourceTypes,
      highestSeverityPresent: highestSeverity(highPriorityIssues),
    },
  };

  return AiAnalysisContextSchema.parse(context);
}
