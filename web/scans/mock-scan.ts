import {
  SCAN_PROGRESS_STAGES,
  applyMockScanResults,
  markScanCompleted,
  markScanFailed,
  markScanRunning,
  setScanProgress,
} from "./lifecycle.ts";
import type { ScanProgressStage } from "../db/repositories/scans.repository.ts";

/** Delay between mock stages (ms). Kept short for responsive local demos. */
const STAGE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Temporary in-process mock scan runner.
 * Advances through progress stages, writes mock results, then completes.
 * On any error, marks the scan FAILED with the error message.
 *
 * Does not call Shopify APIs or analyze real store data.
 */
export async function runMockScan(scanId: string): Promise<void> {
  try {
    await markScanRunning(scanId);

    // Advance through all stages except COMPLETED (that is set by markScanCompleted)
    const workingStages = SCAN_PROGRESS_STAGES.filter(
      (stage): stage is Exclude<ScanProgressStage, "COMPLETED"> =>
        stage !== "COMPLETED"
    );

    for (const stage of workingStages) {
      await setScanProgress(scanId, stage);
      await sleep(STAGE_DELAY_MS);
    }

    await applyMockScanResults(scanId);
    await markScanCompleted(scanId);

    console.log(`✅ Mock scan completed: ${scanId}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mock scan failed unexpectedly";
    console.error(`❌ Mock scan failed (${scanId}):`, message);

    try {
      await markScanFailed(scanId, message);
    } catch (failError) {
      console.error(
        `❌ Unable to persist FAILED status for scan ${scanId}:`,
        failError
      );
    }
  }
}

/**
 * Starts the mock scan without blocking the HTTP response.
 */
export function enqueueMockScan(scanId: string): void {
  setImmediate(() => {
    void runMockScan(scanId);
  });
}
