import pool, { query } from "../client.ts";
import { buildIssueFingerprint } from "../../issues/fingerprint.ts";

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface Issue {
  id: string;
  scan_id: string;
  category: string;
  rule_id: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  impact_score: number;
  confidence_score: number;
  affected_resource: string | null;
  affected_resource_type: string | null;
  recommendation: string | null;
  metadata: Record<string, any>;
  fingerprint: string | null;
  created_at: Date;
}

export interface CreateIssueInput {
  scanId: string;
  category: string;
  ruleId: string;
  title: string;
  description?: string;
  severity: IssueSeverity;
  impactScore?: number;
  confidenceScore?: number;
  affectedResource?: string;
  affectedResourceType?: string;
  recommendation?: string;
  metadata?: Record<string, any>;
  fingerprint?: string;
}

function resolveFingerprint(input: CreateIssueInput): string {
  if (input.fingerprint?.trim()) return input.fingerprint.trim();
  return buildIssueFingerprint({
    ruleId: input.ruleId,
    title: input.title,
    affectedResource: input.affectedResource,
    affectedResourceType: input.affectedResourceType,
    metadata: input.metadata,
  });
}

export interface IssueCountSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Creates a single issue record.
 */
export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  const fingerprint = resolveFingerprint(input);
  const result = await query<Issue>(
    `INSERT INTO issues (
      scan_id, category, rule_id, title, description,
      severity, impact_score, confidence_score,
      affected_resource, affected_resource_type, recommendation, metadata,
      fingerprint
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *;`,
    [
      input.scanId,
      input.category,
      input.ruleId,
      input.title,
      input.description || null,
      input.severity,
      input.impactScore ?? 0,
      input.confidenceScore ?? 0,
      input.affectedResource || null,
      input.affectedResourceType || null,
      input.recommendation || null,
      JSON.stringify(input.metadata || {}),
      fingerprint,
    ]
  );
  return result.rows[0];
}

/**
 * Batch creates multiple issues within a single database transaction.
 */
export async function createMultipleIssues(
  issues: CreateIssueInput[]
): Promise<Issue[]> {
  if (issues.length === 0) return [];

  const client = await pool.connect();
  const createdIssues: Issue[] = [];

  try {
    await client.query("BEGIN");
    for (const issue of issues) {
      const fingerprint = resolveFingerprint(issue);
      const res = await client.query<Issue>(
        `INSERT INTO issues (
          scan_id, category, rule_id, title, description,
          severity, impact_score, confidence_score,
          affected_resource, affected_resource_type, recommendation, metadata,
          fingerprint
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;`,
        [
          issue.scanId,
          issue.category,
          issue.ruleId,
          issue.title,
          issue.description || null,
          issue.severity,
          issue.impactScore ?? 0,
          issue.confidenceScore ?? 0,
          issue.affectedResource || null,
          issue.affectedResourceType || null,
          issue.recommendation || null,
          JSON.stringify(issue.metadata || {}),
          fingerprint,
        ]
      );
      createdIssues.push(res.rows[0]);
    }
    await client.query("COMMIT");
    return createdIssues;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to create multiple issues:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retrieves all issues associated with a scan.
 */
export async function getIssuesForScan(scanId: string): Promise<Issue[]> {
  const result = await query<Issue>(
    "SELECT * FROM issues WHERE scan_id = $1 ORDER BY created_at ASC;",
    [scanId]
  );
  return result.rows;
}

/**
 * Filters issues for a scan by audit category.
 */
export async function getIssuesByCategory(
  scanId: string,
  category: string
): Promise<Issue[]> {
  const result = await query<Issue>(
    `SELECT * FROM issues
     WHERE scan_id = $1 AND category = $2
     ORDER BY created_at ASC;`,
    [scanId, category]
  );
  return result.rows;
}

/**
 * Filters issues for a scan by severity level.
 */
export async function getIssuesBySeverity(
  scanId: string,
  severity: IssueSeverity
): Promise<Issue[]> {
  const result = await query<Issue>(
    `SELECT * FROM issues
     WHERE scan_id = $1 AND severity = $2
     ORDER BY created_at ASC;`,
    [scanId, severity]
  );
  return result.rows;
}

/**
 * Calculates issue count summary (total and counts per severity) for a scan.
 */
export async function getIssueCountsByScan(
  scanId: string
): Promise<IssueCountSummary> {
  const result = await query<{
    total: string;
    critical: string;
    high: string;
    medium: string;
    low: string;
  }>(
    `SELECT
       COUNT(*)::INT as total,
       COUNT(*) FILTER (WHERE severity = 'critical')::INT as critical,
       COUNT(*) FILTER (WHERE severity = 'high')::INT as high,
       COUNT(*) FILTER (WHERE severity = 'medium')::INT as medium,
       COUNT(*) FILTER (WHERE severity = 'low')::INT as low
     FROM issues
     WHERE scan_id = $1;`,
    [scanId]
  );

  const row = result.rows[0];
  return {
    total: parseInt(row?.total || "0", 10),
    critical: parseInt(row?.critical || "0", 10),
    high: parseInt(row?.high || "0", 10),
    medium: parseInt(row?.medium || "0", 10),
    low: parseInt(row?.low || "0", 10),
  };
}

/**
 * Top priority issues: severity → impact → confidence.
 */
export async function getTopPriorityIssues(
  scanId: string,
  limit = 10
): Promise<Issue[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await query<Issue>(
    `SELECT * FROM issues
     WHERE scan_id = $1
     ORDER BY
       CASE severity
         WHEN 'critical' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         WHEN 'low' THEN 3
         ELSE 4
       END ASC,
       impact_score DESC,
       confidence_score DESC,
       created_at ASC
     LIMIT $2;`,
    [scanId, safeLimit]
  );
  return result.rows;
}

/**
 * Issues for a specific rule id (e.g. section load-risk findings).
 */
export async function getIssuesByRuleId(
  scanId: string,
  ruleId: string,
  limit = 10
): Promise<Issue[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await query<Issue>(
    `SELECT * FROM issues
     WHERE scan_id = $1 AND rule_id = $2
     ORDER BY
       CASE severity
         WHEN 'critical' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         WHEN 'low' THEN 3
         ELSE 4
       END ASC,
       impact_score DESC,
       created_at ASC
     LIMIT $3;`,
    [scanId, ruleId, safeLimit]
  );
  return result.rows;
}

export interface AffectedResourceSummary {
  affected_resource: string;
  affected_resource_type: string | null;
  issue_count: number;
  highest_severity: IssueSeverity | string;
}

/**
 * Distinct affected resources for a scan, ordered by issue volume.
 */
export async function getAffectedResourcesForScan(
  scanId: string,
  limit = 20
): Promise<AffectedResourceSummary[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await query<{
    affected_resource: string;
    affected_resource_type: string | null;
    issue_count: string;
    highest_severity: string;
  }>(
    `SELECT
       affected_resource,
       affected_resource_type,
       COUNT(*)::INT AS issue_count,
       (
         ARRAY_AGG(
           severity
           ORDER BY
             CASE severity
               WHEN 'critical' THEN 0
               WHEN 'high' THEN 1
               WHEN 'medium' THEN 2
               WHEN 'low' THEN 3
               ELSE 4
             END ASC
         )
       )[1] AS highest_severity
     FROM issues
     WHERE scan_id = $1
       AND affected_resource IS NOT NULL
       AND TRIM(affected_resource) <> ''
     GROUP BY affected_resource, affected_resource_type
     ORDER BY issue_count DESC, affected_resource ASC
     LIMIT $2;`,
    [scanId, safeLimit]
  );

  return result.rows.map((row) => ({
    affected_resource: row.affected_resource,
    affected_resource_type: row.affected_resource_type,
    issue_count: parseInt(String(row.issue_count), 10),
    highest_severity: row.highest_severity,
  }));
}
