import { z } from "zod";

/**
 * Structured context sent to the AI — built only from rule-engine output.
 */
export const AiIssueSnapshotSchema = z.object({
  id: z.string().uuid(),
  ruleId: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  impactScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().int().min(0).max(100),
  affectedResource: z.string().nullable(),
  affectedResourceType: z.string().nullable(),
  recommendation: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AiAnalysisContextSchema = z.object({
  scanId: z.string().uuid(),
  shopDomain: z.string().optional(),
  storeHealthScore: z.number().int().min(0).max(100),
  categoryScores: z.object({
    performance: z.number().int().min(0).max(100),
    seo: z.number().int().min(0).max(100),
    accessibility: z.number().int().min(0).max(100),
    theme: z.number().int().min(0).max(100),
    product: z.number().int().min(0).max(100),
  }),
  issueCounts: z.object({
    total: z.number().int().min(0),
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
  }),
  highPriorityIssues: z.array(AiIssueSnapshotSchema),
  technicalMetadata: z.object({
    uniqueRuleIds: z.array(z.string()),
    categoriesPresent: z.array(z.string()),
    affectedResourceTypes: z.array(z.string()),
    highestSeverityPresent: z
      .enum(["critical", "high", "medium", "low", "none"])
      .optional(),
  }),
});

export type AiAnalysisContext = z.infer<typeof AiAnalysisContextSchema>;
export type AiIssueSnapshot = z.infer<typeof AiIssueSnapshotSchema>;

/**
 * Expected AI output. Every issueId MUST refer to an input issue.
 */
export const AiAnalysisResultSchema = z.object({
  executiveSummary: z.string().min(20).max(4000),
  topThreePriorities: z
    .array(
      z.object({
        rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        // Accept any string; unknown IDs are stripped via enforceKnownIssueIds.
        issueId: z.string().min(1),
        title: z.string().min(1).max(500),
        whyItMatters: z.string().min(1).max(2000),
      })
    )
    .min(0)
    .max(3),
  explanations: z
    .array(
      z.object({
        issueId: z.string().min(1),
        plainEnglish: z.string().min(1).max(2000),
      })
    )
    .max(25),
  recommendedActions: z
    .array(
      z.object({
        issueId: z.string().min(1),
        action: z.string().min(1).max(2000),
        effort: z.enum(["low", "medium", "high"]),
      })
    )
    .max(25),
  quickWins: z
    .array(
      z.object({
        issueId: z.string().min(1),
        action: z.string().min(1).max(1000),
      })
    )
    .max(10),
});

export type AiAnalysisResult = z.infer<typeof AiAnalysisResultSchema>;

/**
 * Drops any AI references to issue IDs that were not in the rule-engine set.
 * Prevents invented issues from being stored.
 */
export function enforceKnownIssueIds(
  result: AiAnalysisResult,
  allowedIssueIds: Set<string>
): AiAnalysisResult {
  const keep = (id: string) => allowedIssueIds.has(id);

  const topThreePriorities = result.topThreePriorities
    .filter((item) => keep(item.issueId))
    .slice(0, 3)
    .map((item, index) => ({
      ...item,
      rank: (index + 1) as 1 | 2 | 3,
    }));

  return {
    executiveSummary: result.executiveSummary,
    topThreePriorities,
    explanations: result.explanations.filter((item) => keep(item.issueId)),
    recommendedActions: result.recommendedActions.filter((item) =>
      keep(item.issueId)
    ),
    quickWins: result.quickWins.filter((item) => keep(item.issueId)),
  };
}
