export {
  SCAN_PROGRESS_STAGES,
  STAGE_PROGRESS_PERCENT,
  ScanLifecycleError,
  createPendingScan,
  markScanRunning,
  setScanProgress,
  markScanCompleted,
  markScanFailed,
  applyMockScanResults,
  isTerminalScanStatus,
  isActiveScanStatus,
} from "./lifecycle.ts";

export { runMockScan, enqueueMockScan } from "./mock-scan.ts";
export { runScan, enqueueScan, type RunScanOptions } from "./runner.ts";
export {
  compareScans,
  compareLatestWithPrevious,
  summarizeComparisonForApi,
  type ScanComparisonResult,
  type ScoreDelta,
  type ComparedIssueSummary,
} from "./compare.ts";
