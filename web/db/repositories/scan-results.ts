import type { Scan } from "./scans.repository.ts";
import {
  getAffectedResourcesForScan,
  getIssueCountsByScan,
  getIssuesByRuleId,
  getIssuesForScan,
  getTopPriorityIssues,
  type AffectedResourceSummary,
  type Issue,
  type IssueCountSummary,
} from "./issues.repository.ts";

export interface SlowSectionSummary {
  title: string;
  description: string | null;
  recommendation: string | null;
  severity: string;
  sectionType: string | null;
  pageKind: string | null;
  pageUrl: string | null;
  weightScore: number | null;
}

export interface ScanResultsPayload {
  scan: Scan;
  scores: {
    overall: number;
    performance: number;
    seo: number;
    accessibility: number;
    theme: number;
    product: number;
  };
  issueCounts: IssueCountSummary;
  topIssues: Issue[];
  slowSections: SlowSectionSummary[];
  affectedResources: AffectedResourceSummary[];
  scanDate: string | null;
}

/**
 * Assembles completed-scan results from PostgreSQL for UI consumption.
 */
export async function buildScanResultsPayload(
  scan: Scan,
  options: { topIssuesLimit?: number; resourcesLimit?: number } = {}
): Promise<ScanResultsPayload> {
  const [issueCounts, topIssues, affectedResources, sectionIssues] =
    await Promise.all([
      getIssueCountsByScan(scan.id),
      getTopPriorityIssues(scan.id, options.topIssuesLimit ?? 8),
      getAffectedResourcesForScan(scan.id, options.resourcesLimit ?? 12),
      getIssuesByRuleId(scan.id, "performance.section-load-risk", 5),
    ]);

  const scanDate =
    scan.completed_at || scan.started_at || scan.created_at || null;

  const slowSections: SlowSectionSummary[] = sectionIssues.map((issue) => {
    const meta = issue.metadata || {};
    return {
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
      severity: issue.severity,
      sectionType:
        typeof meta.sectionType === "string" ? meta.sectionType : null,
      pageKind: typeof meta.pageKind === "string" ? meta.pageKind : null,
      pageUrl: typeof meta.pageUrl === "string" ? meta.pageUrl : null,
      weightScore:
        typeof meta.weightScore === "number" ? meta.weightScore : null,
    };
  });

  return {
    scan,
    scores: {
      overall: scan.overall_score ?? 0,
      performance: scan.performance_score ?? 0,
      seo: scan.seo_score ?? 0,
      accessibility: scan.accessibility_score ?? 0,
      theme: scan.theme_score ?? 0,
      product: scan.product_score ?? 0,
    },
    issueCounts,
    topIssues,
    slowSections,
    affectedResources,
    scanDate: scanDate ? new Date(scanDate).toISOString() : null,
  };
}

export async function getAllIssuesForScanResults(
  scanId: string
): Promise<Issue[]> {
  return getIssuesForScan(scanId);
}
