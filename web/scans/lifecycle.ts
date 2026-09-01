import type { Scan, ScanProgressStage, ScanStatus } from "../db/repositories/scans.repository.ts";
import {
  createScan,
  failScan,
  getActiveScanForShop,
  getScanById,
  updateScanCounters,
  updateScanProgress,
  updateScanScores,
  updateScanStatus,
  updateScanTimestamps,
} from "../db/repositories/scans.repository.ts";

/** Ordered mock/real progress stages for a scan. */
export const SCAN_PROGRESS_STAGES: readonly ScanProgressStage[] = [
  "STORE_DATA",
  "PRODUCTS",
  "THEME",
  "STOREFRONT",
  "ANALYSIS",
  "COMPLETED",
] as const;

/** Approximate percent complete when a stage begins. */
export const STAGE_PROGRESS_PERCENT: Record<ScanProgressStage, number> = {
  STORE_DATA: 5,
  PRODUCTS: 20,
  THEME: 40,
  STOREFRONT: 60,
  ANALYSIS: 80,
  COMPLETED: 100,
};

const TERMINAL_STATUSES: ReadonlySet<ScanStatus> = new Set([
  "COMPLETED",
  "FAILED",
]);

const ALLOWED_TRANSITIONS: Record<ScanStatus, ReadonlySet<ScanStatus>> = {
  PENDING: new Set(["RUNNING", "FAILED"]),
  RUNNING: new Set(["COMPLETED", "FAILED"]),
  COMPLETED: new Set(),
  FAILED: new Set(),
};

export class ScanLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanLifecycleError";
  }
}

function assertTransition(from: ScanStatus, to: ScanStatus): void {
  if (!ALLOWED_TRANSITIONS[from].has(to)) {
    throw new ScanLifecycleError(
      `Invalid scan status transition: ${from} -> ${to}`
    );
  }
}

/**
 * Creates a new scan in PENDING status for the given shop.
 * Rejects if another scan is already PENDING or RUNNING.
 */
export async function createPendingScan(shopId: string): Promise<Scan> {
  const active = await getActiveScanForShop(shopId);
  if (active) {
    throw new ScanLifecycleError(
      `Shop already has an active scan (${active.id}) with status ${active.status}`
    );
  }

  return createScan({ shopId, status: "PENDING" });
}

/**
 * Transitions PENDING -> RUNNING and records started_at.
 */
export async function markScanRunning(scanId: string): Promise<Scan> {
  const scan = await getScanById(scanId);
  if (!scan) {
    throw new ScanLifecycleError(`Scan not found: ${scanId}`);
  }

  assertTransition(scan.status, "RUNNING");

  const updated = await updateScanStatus(scanId, "RUNNING");
  if (!updated) {
    throw new ScanLifecycleError(`Failed to mark scan running: ${scanId}`);
  }

  const withTimestamps = await updateScanTimestamps(scanId, {
    startedAt: new Date(),
  });

  return withTimestamps || updated;
}

/**
 * Persists progress for a RUNNING scan.
 */
export async function setScanProgress(
  scanId: string,
  stage: ScanProgressStage,
  percent?: number
): Promise<Scan> {
  const scan = await getScanById(scanId);
  if (!scan) {
    throw new ScanLifecycleError(`Scan not found: ${scanId}`);
  }

  if (scan.status !== "RUNNING") {
    throw new ScanLifecycleError(
      `Cannot update progress for scan in status ${scan.status}`
    );
  }

  const nextPercent =
    percent ?? STAGE_PROGRESS_PERCENT[stage] ?? scan.progress_percent;

  const updated = await updateScanProgress(scanId, {
    stage,
    percent: nextPercent,
  });

  if (!updated) {
    throw new ScanLifecycleError(`Failed to update progress for scan ${scanId}`);
  }

  return updated;
}

/**
 * Transitions RUNNING -> COMPLETED, sets progress COMPLETED/100%, and completed_at.
 */
export async function markScanCompleted(scanId: string): Promise<Scan> {
  const scan = await getScanById(scanId);
  if (!scan) {
    throw new ScanLifecycleError(`Scan not found: ${scanId}`);
  }

  assertTransition(scan.status, "COMPLETED");

  await updateScanProgress(scanId, {
    stage: "COMPLETED",
    percent: 100,
  });

  const updated = await updateScanStatus(scanId, "COMPLETED");
  if (!updated) {
    throw new ScanLifecycleError(`Failed to complete scan: ${scanId}`);
  }

  const withTimestamps = await updateScanTimestamps(scanId, {
    completedAt: new Date(),
  });

  return withTimestamps || updated;
}

/**
 * Marks a scan FAILED from PENDING or RUNNING, stores error_message, sets completed_at.
 */
export async function markScanFailed(
  scanId: string,
  errorMessage: string
): Promise<Scan> {
  const scan = await getScanById(scanId);
  if (!scan) {
    throw new ScanLifecycleError(`Scan not found: ${scanId}`);
  }

  if (TERMINAL_STATUSES.has(scan.status)) {
    throw new ScanLifecycleError(
      `Cannot fail scan already in terminal status ${scan.status}`
    );
  }

  assertTransition(scan.status, "FAILED");

  const updated = await failScan(
    scanId,
    errorMessage.slice(0, 2000) || "Unknown scan failure"
  );

  if (!updated) {
    throw new ScanLifecycleError(`Failed to mark scan failed: ${scanId}`);
  }

  return updated;
}

/**
 * Applies temporary mock score/counter results (placeholder until real analyzers exist).
 */
export async function applyMockScanResults(scanId: string): Promise<Scan> {
  const scores = await updateScanScores(scanId, {
    overallScore: 78,
    performanceScore: 82,
    seoScore: 75,
    accessibilityScore: 80,
    themeScore: 74,
    productScore: 79,
  });

  await updateScanCounters(scanId, {
    totalIssues: 6,
    criticalIssues: 0,
    highIssues: 2,
    mediumIssues: 3,
    lowIssues: 1,
  });

  const latest = await getScanById(scanId);
  return latest || scores!;
}

export function isTerminalScanStatus(status: ScanStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isActiveScanStatus(status: ScanStatus): boolean {
  return status === "PENDING" || status === "RUNNING";
}
