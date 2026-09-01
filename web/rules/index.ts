export type {
  IssueCategory,
  IssueSeverity,
  ConfidenceLevel,
  DetectedIssue,
  RuleResult,
  RuleContext,
  ScanRule,
} from "./types.ts";

export {
  ISSUE_SEVERITY_ORDER,
  ISSUE_CATEGORIES,
} from "./types.ts";

export type { RunRulesOptions, RunRulesSummary } from "./runner.ts";

export {
  normalizeRuleResult,
  enrichIssues,
  runRule,
  runRules,
  collectIssues,
} from "./runner.ts";

export {
  missingImageAltRule,
  type ExampleImageScanData,
} from "./examples/missing-image-alt.rule.ts";
