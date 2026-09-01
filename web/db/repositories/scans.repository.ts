import { query } from "../client.ts";

export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type ScanProgressStage =
  | "STORE_DATA"
  | "PRODUCTS"
  | "THEME"
  | "STOREFRONT"
  | "ANALYSIS"
  | "COMPLETED";

export interface Scan {
  id: string;
  shop_id: string;
  status: ScanStatus;
  progress_stage: ScanProgressStage | null;
  progress_percent: number;
  error_message: string | null;
  overall_score: number;
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  theme_score: number;
  product_score: number;
  total_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface CreateScanInput {
  shopId: string;
  status?: ScanStatus;
}

export interface UpdateScanScoresInput {
  overallScore?: number;
  performanceScore?: number;
  seoScore?: number;
  accessibilityScore?: number;
  themeScore?: number;
  productScore?: number;
}

export interface UpdateScanCountersInput {
  totalIssues?: number;
  criticalIssues?: number;
  highIssues?: number;
  mediumIssues?: number;
  lowIssues?: number;
}

export interface UpdateScanTimestampsInput {
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface UpdateScanProgressInput {
  stage: ScanProgressStage;
  percent: number;
}

/**
 * Creates a new audit scan for a shop (defaults to PENDING).
 */
export async function createScan(input: CreateScanInput): Promise<Scan> {
  const result = await query<Scan>(
    `INSERT INTO scans (shop_id, status, progress_percent)
     VALUES ($1, COALESCE($2, 'PENDING'), 0)
     RETURNING *;`,
    [input.shopId, input.status || "PENDING"]
  );
  return result.rows[0];
}

/**
 * Retrieves a scan by its UUID.
 */
export async function getScanById(id: string): Promise<Scan | null> {
  const result = await query<Scan>(
    "SELECT * FROM scans WHERE id = $1 LIMIT 1;",
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Retrieves all scans for a specific shop ordered by most recent first.
 */
export async function getScansForShop(
  shopId: string,
  limit = 20,
  offset = 0
): Promise<Scan[]> {
  const result = await query<Scan>(
    `SELECT * FROM scans
     WHERE shop_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3;`,
    [shopId, limit, offset]
  );
  return result.rows;
}

/**
 * Returns the most recently completed scan for a shop, if any.
 */
export async function getLatestCompletedScanForShop(
  shopId: string
): Promise<Scan | null> {
  const result = await query<Scan>(
    `SELECT * FROM scans
     WHERE shop_id = $1 AND status = 'COMPLETED'
     ORDER BY COALESCE(completed_at, created_at) DESC
     LIMIT 1;`,
    [shopId]
  );
  return result.rows[0] || null;
}

/**
 * Completed scans for a shop, newest first.
 */
export async function getCompletedScansForShop(
  shopId: string,
  limit = 20,
  offset = 0
): Promise<Scan[]> {
  const result = await query<Scan>(
    `SELECT * FROM scans
     WHERE shop_id = $1 AND status = 'COMPLETED'
     ORDER BY COALESCE(completed_at, created_at) DESC
     LIMIT $2 OFFSET $3;`,
    [shopId, limit, offset]
  );
  return result.rows;
}

/**
 * Previous completed scan before the given scan (same shop).
 */
export async function getPreviousCompletedScan(
  shopId: string,
  beforeScanId: string
): Promise<Scan | null> {
  const current = await getScanById(beforeScanId);
  if (!current || current.shop_id !== shopId) {
    return null;
  }

  const anchor = current.completed_at || current.created_at;
  const result = await query<Scan>(
    `SELECT * FROM scans
     WHERE shop_id = $1
       AND status = 'COMPLETED'
       AND id <> $2
       AND COALESCE(completed_at, created_at) < $3
     ORDER BY COALESCE(completed_at, created_at) DESC
     LIMIT 1;`,
    [shopId, beforeScanId, anchor]
  );
  return result.rows[0] || null;
}

/**
 * Returns the latest in-flight scan for a shop, if any.
 */
export async function getActiveScanForShop(
  shopId: string
): Promise<Scan | null> {
  const result = await query<Scan>(
    `SELECT * FROM scans
     WHERE shop_id = $1 AND status IN ('PENDING', 'RUNNING')
     ORDER BY created_at DESC
     LIMIT 1;`,
    [shopId]
  );
  return result.rows[0] || null;
}

/**
 * Updates the status of a scan (e.g. PENDING -> RUNNING -> COMPLETED).
 */
export async function updateScanStatus(
  id: string,
  status: ScanStatus
): Promise<Scan | null> {
  const result = await query<Scan>(
    `UPDATE scans
     SET status = $2
     WHERE id = $1
     RETURNING *;`,
    [id, status]
  );
  return result.rows[0] || null;
}

/**
 * Updates progress stage and percent for a running scan.
 */
export async function updateScanProgress(
  id: string,
  progress: UpdateScanProgressInput
): Promise<Scan | null> {
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
  const result = await query<Scan>(
    `UPDATE scans
     SET progress_stage = $2,
         progress_percent = $3
     WHERE id = $1
     RETURNING *;`,
    [id, progress.stage, percent]
  );
  return result.rows[0] || null;
}

/**
 * Marks a scan as FAILED and stores the error message.
 */
export async function failScan(
  id: string,
  errorMessage: string
): Promise<Scan | null> {
  const result = await query<Scan>(
    `UPDATE scans
     SET status = 'FAILED',
         error_message = $2,
         completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
     WHERE id = $1
     RETURNING *;`,
    [id, errorMessage]
  );
  return result.rows[0] || null;
}

/**
 * Updates computed audit scores for a scan.
 */
export async function updateScanScores(
  id: string,
  scores: UpdateScanScoresInput
): Promise<Scan | null> {
  const result = await query<Scan>(
    `UPDATE scans
     SET overall_score = COALESCE($2, overall_score),
         performance_score = COALESCE($3, performance_score),
         seo_score = COALESCE($4, seo_score),
         accessibility_score = COALESCE($5, accessibility_score),
         theme_score = COALESCE($6, theme_score),
         product_score = COALESCE($7, product_score)
     WHERE id = $1
     RETURNING *;`,
    [
      id,
      scores.overallScore ?? null,
      scores.performanceScore ?? null,
      scores.seoScore ?? null,
      scores.accessibilityScore ?? null,
      scores.themeScore ?? null,
      scores.productScore ?? null,
    ]
  );
  return result.rows[0] || null;
}

/**
 * Updates total and severity issue counts for a scan.
 */
export async function updateScanCounters(
  id: string,
  counts: UpdateScanCountersInput
): Promise<Scan | null> {
  const result = await query<Scan>(
    `UPDATE scans
     SET total_issues = COALESCE($2, total_issues),
         critical_issues = COALESCE($3, critical_issues),
         high_issues = COALESCE($4, high_issues),
         medium_issues = COALESCE($5, medium_issues),
         low_issues = COALESCE($6, low_issues)
     WHERE id = $1
     RETURNING *;`,
    [
      id,
      counts.totalIssues ?? null,
      counts.criticalIssues ?? null,
      counts.highIssues ?? null,
      counts.mediumIssues ?? null,
      counts.lowIssues ?? null,
    ]
  );
  return result.rows[0] || null;
}

/**
 * Updates execution timestamps (started_at, completed_at).
 */
export async function updateScanTimestamps(
  id: string,
  timestamps: UpdateScanTimestampsInput
): Promise<Scan | null> {
  const result = await query<Scan>(
    `UPDATE scans
     SET started_at = COALESCE($2, started_at),
         completed_at = COALESCE($3, completed_at)
     WHERE id = $1
     RETURNING *;`,
    [id, timestamps.startedAt || null, timestamps.completedAt || null]
  );
  return result.rows[0] || null;
}

export type DeleteScanResult = "deleted" | "not_found" | "active";

/**
 * Deletes a scan for a shop. Related issues and AI analyses cascade.
 * In-flight scans cannot be deleted.
 */
export async function deleteScanForShop(
  shopId: string,
  scanId: string
): Promise<DeleteScanResult> {
  const scan = await getScanById(scanId);
  if (!scan || scan.shop_id !== shopId) {
    return "not_found";
  }

  if (scan.status === "PENDING" || scan.status === "RUNNING") {
    return "active";
  }

  await query("DELETE FROM scans WHERE id = $1 AND shop_id = $2;", [
    scanId,
    shopId,
  ]);
  return "deleted";
}
