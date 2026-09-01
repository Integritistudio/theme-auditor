/**
 * Deterministic StoreAudit scoring engine.
 * AI is not used — scores are pure functions of issue inputs.
 */

export type ScoringSeverity = "critical" | "high" | "medium" | "low";

export type ScoreCategory =
  | "performance"
  | "seo"
  | "accessibility"
  | "theme"
  | "product";

/** Minimal issue shape required by the scoring engine. */
export interface ScoringIssueInput {
  id?: string | null;
  category: string;
  rule_id: string;
  severity: ScoringSeverity | string;
  impact_score: number;
  confidence_score: number;
  affected_resource?: string | null;
}

export interface CategoryScoreBreakdown {
  category: ScoreCategory;
  score: number;
  issueCount: number;
  uniqueResources: number;
  rawPenalty: number;
  breadthPenalty: number;
  totalPenalty: number;
}

export interface ScanScoresResult {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  themeScore: number;
  productScore: number;
  overallScore: number;
  categories: CategoryScoreBreakdown[];
}

/**
 * Fixed severity weights (points deducted at full impact × confidence).
 * Transparent and stable across runs.
 */
export const SEVERITY_WEIGHTS: Record<ScoringSeverity, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 2,
};

/**
 * Overall Store Health weights (must sum to 1.0).
 */
export const OVERALL_WEIGHTS: Record<ScoreCategory, number> = {
  performance: 0.2,
  seo: 0.2,
  accessibility: 0.2,
  theme: 0.2,
  product: 0.2,
};

/** Max extra penalty from unique affected resources in a category. */
export const MAX_BREADTH_PENALTY = 10;

/** Points per unique affected resource (breadth). */
export const BREADTH_PENALTY_PER_RESOURCE = 0.5;

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeUnitInterval(
  value: number,
  fallback: number
): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(0.05, Math.min(1, value / 100));
}

export function normalizeSeverity(
  severity: string | null | undefined
): ScoringSeverity {
  const s = (severity || "").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") {
    return s;
  }
  return "medium";
}

/**
 * Maps an issue to one scoring category.
 *
 * Uses the issue's display category first so scores match what merchants see
 * in the issues list (e.g. product catalog findings tagged "SEO" reduce the
 * SEO score). Theme file rules always map to theme; performance impact is
 * mirrored separately in calculateScanScores.
 */
export function resolveScoreCategory(
  issue: Pick<ScoringIssueInput, "category" | "rule_id">
): ScoreCategory | null {
  const ruleId = (issue.rule_id || "").toLowerCase();
  const category = (issue.category || "").toLowerCase();

  if (ruleId.startsWith("theme.")) {
    return "theme";
  }

  if (category === "product" || category === "image") {
    return "product";
  }
  if (category === "seo") {
    return "seo";
  }
  if (category === "accessibility") {
    return "accessibility";
  }
  if (category === "theme") {
    return "theme";
  }
  if (category === "performance" || category === "script") {
    return "performance";
  }

  if (ruleId.startsWith("product.")) {
    return "product";
  }
  if (ruleId.startsWith("seo.")) {
    return "seo";
  }
  if (ruleId.startsWith("a11y.")) {
    return "accessibility";
  }
  if (ruleId.startsWith("performance.")) {
    return "performance";
  }

  return null;
}

/**
 * Single-issue penalty:
 *   penalty = severityWeight × impactNorm × confidenceNorm
 *
 * impactNorm / confidenceNorm are impact_score and confidence_score scaled to (0,1].
 */
export function calculateIssuePenalty(issue: ScoringIssueInput): number {
  const severity = normalizeSeverity(issue.severity);
  const weight = SEVERITY_WEIGHTS[severity];
  const impactNorm = normalizeUnitInterval(issue.impact_score, 0.55);
  const confidenceNorm = normalizeUnitInterval(issue.confidence_score, 0.7);
  return weight * impactNorm * confidenceNorm;
}

function stableSortIssues(issues: ScoringIssueInput[]): ScoringIssueInput[] {
  return [...issues].sort((a, b) => {
    const idA = a.id || `${a.rule_id}:${a.affected_resource || ""}`;
    const idB = b.id || `${b.rule_id}:${b.affected_resource || ""}`;
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
}

function uniqueResourceCount(issues: ScoringIssueInput[]): number {
  const set = new Set<string>();
  for (const issue of issues) {
    const resource = (issue.affected_resource || "").trim();
    if (resource) set.add(resource);
  }
  return set.size;
}

/**
 * Category score:
 *   totalPenalty = Σ issuePenalty + min(MAX_BREADTH, uniqueResources × BREADTH_PER_RESOURCE)
 *   score = clamp(100 - totalPenalty, 0, 100)
 *
 * Empty category ⇒ 100.
 */
export function calculateCategoryScore(
  category: ScoreCategory,
  issues: ScoringIssueInput[]
): CategoryScoreBreakdown {
  const sorted = stableSortIssues(issues);
  let rawPenalty = 0;
  for (const issue of sorted) {
    rawPenalty += calculateIssuePenalty(issue);
  }

  const uniqueResources = uniqueResourceCount(sorted);
  const breadthPenalty = Math.min(
    MAX_BREADTH_PENALTY,
    uniqueResources * BREADTH_PENALTY_PER_RESOURCE
  );
  const totalPenalty = rawPenalty + breadthPenalty;
  const score = clampScore(100 - totalPenalty);

  return {
    category,
    score,
    issueCount: sorted.length,
    uniqueResources,
    rawPenalty: Number(rawPenalty.toFixed(6)),
    breadthPenalty: Number(breadthPenalty.toFixed(6)),
    totalPenalty: Number(totalPenalty.toFixed(6)),
  };
}

/**
 * Overall Store Health Score:
 *   overall = round(Σ categoryScore × weight)
 * with equal weights (0.20 each) from OVERALL_WEIGHTS.
 */
export function calculateOverallScore(
  categoryScores: Record<ScoreCategory, number>
): number {
  let weighted = 0;
  for (const category of Object.keys(OVERALL_WEIGHTS) as ScoreCategory[]) {
    weighted += categoryScores[category] * OVERALL_WEIGHTS[category];
  }
  return clampScore(weighted);
}

/**
 * Calculate all category scores + overall from a flat issue list.
 * Same inputs always produce the same outputs.
 */
export function calculateScanScores(
  issues: ScoringIssueInput[]
): ScanScoresResult {
  const buckets: Record<ScoreCategory, ScoringIssueInput[]> = {
    performance: [],
    seo: [],
    accessibility: [],
    theme: [],
    product: [],
  };

  for (const issue of stableSortIssues(issues)) {
    const category = resolveScoreCategory(issue);
    if (!category) continue;
    buckets[category].push(issue);
  }

  // theme.* findings with PERFORMANCE/SCRIPT category also reduce Performance Score.
  for (const issue of stableSortIssues(issues)) {
    const ruleId = (issue.rule_id || "").toLowerCase();
    const category = (issue.category || "").toLowerCase();
    if (
      ruleId.startsWith("theme.") &&
      (category === "performance" || category === "script")
    ) {
      buckets.performance.push(issue);
    }
  }

  const categories = (Object.keys(buckets) as ScoreCategory[]).map((category) =>
    calculateCategoryScore(category, buckets[category])
  );

  const byCategory = Object.fromEntries(
    categories.map((c) => [c.category, c.score])
  ) as Record<ScoreCategory, number>;

  return {
    performanceScore: byCategory.performance,
    seoScore: byCategory.seo,
    accessibilityScore: byCategory.accessibility,
    themeScore: byCategory.theme,
    productScore: byCategory.product,
    overallScore: calculateOverallScore(byCategory),
    categories,
  };
}
