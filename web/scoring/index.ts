export {
  SEVERITY_WEIGHTS,
  OVERALL_WEIGHTS,
  MAX_BREADTH_PENALTY,
  BREADTH_PENALTY_PER_RESOURCE,
  clampScore,
  normalizeUnitInterval,
  normalizeSeverity,
  resolveScoreCategory,
  calculateIssuePenalty,
  calculateCategoryScore,
  calculateOverallScore,
  calculateScanScores,
  type ScoringSeverity,
  type ScoreCategory,
  type ScoringIssueInput,
  type CategoryScoreBreakdown,
  type ScanScoresResult,
} from "./engine.ts";

export { recalculateAndPersistScanScores } from "./persist.ts";
