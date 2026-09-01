import { getIssueCountsByScan, getIssuesForScan } from "../db/repositories/issues.repository.ts";
import {
  updateScanCounters,
  updateScanScores,
  type Scan,
} from "../db/repositories/scans.repository.ts";
import {
  calculateScanScores,
  type ScanScoresResult,
  type ScoringIssueInput,
} from "./engine.ts";

/**
 * Loads scan issues, computes deterministic scores, and persists them to PostgreSQL.
 */
export async function recalculateAndPersistScanScores(
  scanId: string
): Promise<{ scores: ScanScoresResult; scan: Scan | null }> {
  const issues = await getIssuesForScan(scanId);
  const scoringInputs: ScoringIssueInput[] = issues.map((issue) => ({
    id: issue.id,
    category: issue.category,
    rule_id: issue.rule_id,
    severity: issue.severity,
    impact_score: issue.impact_score,
    confidence_score: issue.confidence_score,
    affected_resource: issue.affected_resource,
  }));

  const scores = calculateScanScores(scoringInputs);

  const counts = await getIssueCountsByScan(scanId);
  await updateScanCounters(scanId, {
    totalIssues: counts.total,
    criticalIssues: counts.critical,
    highIssues: counts.high,
    mediumIssues: counts.medium,
    lowIssues: counts.low,
  });

  const scan = await updateScanScores(scanId, {
    overallScore: scores.overallScore,
    performanceScore: scores.performanceScore,
    seoScore: scores.seoScore,
    accessibilityScore: scores.accessibilityScore,
    themeScore: scores.themeScore,
    productScore: scores.productScore,
  });

  return { scores, scan };
}
