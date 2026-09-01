import { fingerprintFromIssueRow } from "../issues/fingerprint.ts";
import {
  getIssuesForScan,
  type Issue,
} from "../db/repositories/issues.repository.ts";
import {
  getLatestCompletedScanForShop,
  getPreviousCompletedScan,
  getScanById,
  type Scan,
} from "../db/repositories/scans.repository.ts";

export interface ScoreSnapshot {
  overall: number;
  performance: number;
  seo: number;
  accessibility: number;
  theme: number;
  product: number;
}

export interface ScoreDelta {
  key: keyof ScoreSnapshot;
  label: string;
  previous: number;
  current: number;
  delta: number;
  direction: "improved" | "declined" | "unchanged";
}

export interface ComparedIssueSummary {
  fingerprint: string;
  ruleId: string;
  title: string;
  category: string;
  severity: string;
  affectedResource: string | null;
  affectedResourceType: string | null;
  impactScore: number;
}

export interface ScanComparisonResult {
  currentScan: {
    id: string;
    completedAt: string | null;
    scores: ScoreSnapshot;
    totalIssues: number;
  };
  previousScan: {
    id: string;
    completedAt: string | null;
    scores: ScoreSnapshot;
    totalIssues: number;
  };
  scoreChanges: ScoreDelta[];
  overallDirection: "improved" | "declined" | "unchanged";
  issues: {
    resolved: ComparedIssueSummary[];
    new: ComparedIssueSummary[];
    unchanged: ComparedIssueSummary[];
    counts: {
      resolved: number;
      new: number;
      unchanged: number;
    };
  };
}

function scoresFromScan(scan: Scan): ScoreSnapshot {
  return {
    overall: scan.overall_score ?? 0,
    performance: scan.performance_score ?? 0,
    seo: scan.seo_score ?? 0,
    accessibility: scan.accessibility_score ?? 0,
    theme: scan.theme_score ?? 0,
    product: scan.product_score ?? 0,
  };
}

function directionForDelta(delta: number): "improved" | "declined" | "unchanged" {
  if (delta > 0) return "improved";
  if (delta < 0) return "declined";
  return "unchanged";
}

function toSummary(issue: Issue, fingerprint: string): ComparedIssueSummary {
  return {
    fingerprint,
    ruleId: issue.rule_id,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    affectedResource: issue.affected_resource,
    affectedResourceType: issue.affected_resource_type,
    impactScore: issue.impact_score ?? 0,
  };
}

function indexIssuesByFingerprint(issues: Issue[]): Map<string, Issue> {
  const map = new Map<string, Issue>();
  for (const issue of issues) {
    const fingerprint = fingerprintFromIssueRow(issue);
    // Keep highest-impact instance when duplicates share a fingerprint
    const existing = map.get(fingerprint);
    if (
      !existing ||
      (issue.impact_score ?? 0) > (existing.impact_score ?? 0)
    ) {
      map.set(fingerprint, issue);
    }
  }
  return map;
}

function buildScoreChanges(
  previous: ScoreSnapshot,
  current: ScoreSnapshot
): ScoreDelta[] {
  const defs: Array<{ key: keyof ScoreSnapshot; label: string }> = [
    { key: "overall", label: "Store Health" },
    { key: "performance", label: "Performance" },
    { key: "seo", label: "SEO" },
    { key: "accessibility", label: "Accessibility" },
    { key: "theme", label: "Theme" },
    { key: "product", label: "Product" },
  ];

  return defs.map(({ key, label }) => {
    const prev = previous[key];
    const curr = current[key];
    const delta = curr - prev;
    return {
      key,
      label,
      previous: prev,
      current: curr,
      delta,
      direction: directionForDelta(delta),
    };
  });
}

/**
 * Compares two completed scans using stable issue fingerprints.
 */
export async function compareScans(
  currentScan: Scan,
  previousScan: Scan
): Promise<ScanComparisonResult> {
  const [currentIssues, previousIssues] = await Promise.all([
    getIssuesForScan(currentScan.id),
    getIssuesForScan(previousScan.id),
  ]);

  const currentMap = indexIssuesByFingerprint(currentIssues);
  const previousMap = indexIssuesByFingerprint(previousIssues);

  const resolved: ComparedIssueSummary[] = [];
  const unchanged: ComparedIssueSummary[] = [];
  const newlyFound: ComparedIssueSummary[] = [];

  for (const [fingerprint, issue] of previousMap) {
    if (currentMap.has(fingerprint)) {
      unchanged.push(toSummary(issue, fingerprint));
    } else {
      resolved.push(toSummary(issue, fingerprint));
    }
  }

  for (const [fingerprint, issue] of currentMap) {
    if (!previousMap.has(fingerprint)) {
      newlyFound.push(toSummary(issue, fingerprint));
    }
  }

  const sortByImpact = (a: ComparedIssueSummary, b: ComparedIssueSummary) =>
    b.impactScore - a.impactScore || a.title.localeCompare(b.title);

  resolved.sort(sortByImpact);
  newlyFound.sort(sortByImpact);
  unchanged.sort(sortByImpact);

  const currentScores = scoresFromScan(currentScan);
  const previousScores = scoresFromScan(previousScan);
  const scoreChanges = buildScoreChanges(previousScores, currentScores);
  const overallDelta = currentScores.overall - previousScores.overall;

  return {
    currentScan: {
      id: currentScan.id,
      completedAt: currentScan.completed_at
        ? new Date(currentScan.completed_at).toISOString()
        : null,
      scores: currentScores,
      totalIssues: currentIssues.length,
    },
    previousScan: {
      id: previousScan.id,
      completedAt: previousScan.completed_at
        ? new Date(previousScan.completed_at).toISOString()
        : null,
      scores: previousScores,
      totalIssues: previousIssues.length,
    },
    scoreChanges,
    overallDirection: directionForDelta(overallDelta),
    issues: {
      resolved,
      new: newlyFound,
      unchanged,
      counts: {
        resolved: resolved.length,
        new: newlyFound.length,
        unchanged: unchanged.length,
      },
    },
  };
}

/**
 * Compares the latest completed scan with the immediately previous completed scan.
 */
export async function compareLatestWithPrevious(
  shopId: string,
  currentScanId?: string
): Promise<ScanComparisonResult | null> {
  let current: Scan | null = null;

  if (currentScanId) {
    current = await getScanById(currentScanId);
    if (!current || current.shop_id !== shopId || current.status !== "COMPLETED") {
      return null;
    }
  } else {
    current = await getLatestCompletedScanForShop(shopId);
  }

  if (!current) return null;

  const previous = await getPreviousCompletedScan(shopId, current.id);
  if (!previous) return null;

  return compareScans(current, previous);
}

/**
 * Trims large issue lists for API payloads while keeping accurate counts.
 */
export function summarizeComparisonForApi(
  comparison: ScanComparisonResult,
  sampleLimit = 15
): ScanComparisonResult {
  return {
    ...comparison,
    issues: {
      ...comparison.issues,
      resolved: comparison.issues.resolved.slice(0, sampleLimit),
      new: comparison.issues.new.slice(0, sampleLimit),
      unchanged: comparison.issues.unchanged.slice(0, sampleLimit),
    },
  };
}
