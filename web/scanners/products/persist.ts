import {
  createMultipleIssues,
  type CreateIssueInput,
  type IssueSeverity as DbIssueSeverity,
} from "../../db/repositories/issues.repository.ts";
import type {
  ConfidenceLevel,
  DetectedIssue,
  IssueCategory,
  IssueSeverity,
} from "../../rules/types.ts";

const SEVERITY_MAP: Record<IssueSeverity, DbIssueSeverity> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "low",
};

const CONFIDENCE_SCORE: Record<ConfidenceLevel, number> = {
  HIGH: 90,
  MEDIUM: 70,
  LOW: 40,
};

const IMPACT_SCORE: Record<IssueSeverity, number> = {
  CRITICAL: 95,
  HIGH: 80,
  MEDIUM: 55,
  LOW: 30,
  INFO: 10,
};

function toDbCategory(category: IssueCategory): string {
  return category.toLowerCase();
}

/**
 * Maps a rule-engine DetectedIssue into the PostgreSQL issues insert shape.
 */
export function detectedIssueToCreateInput(
  scanId: string,
  issue: DetectedIssue
): CreateIssueInput {
  return {
    scanId,
    category: toDbCategory(issue.category),
    ruleId: issue.ruleId,
    title: issue.title,
    description: issue.description,
    severity: SEVERITY_MAP[issue.severity] || "medium",
    impactScore: IMPACT_SCORE[issue.severity] ?? 50,
    confidenceScore: CONFIDENCE_SCORE[issue.confidence] ?? 70,
    affectedResource: issue.affectedResource,
    affectedResourceType: issue.affectedResourceType,
    recommendation: issue.recommendation,
    metadata: issue.metadata || {},
  };
}

/**
 * Persists detected issues in fixed-size DB batches.
 */
export async function saveDetectedIssues(
  scanId: string,
  issues: DetectedIssue[],
  batchSize = 100
): Promise<number> {
  if (issues.length === 0) return 0;

  let saved = 0;
  for (let i = 0; i < issues.length; i += batchSize) {
    const chunk = issues.slice(i, i + batchSize);
    const rows = chunk.map((issue) =>
      detectedIssueToCreateInput(scanId, issue)
    );
    await createMultipleIssues(rows);
    saved += rows.length;
  }
  return saved;
}
