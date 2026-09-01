/**
 * Shared rule-engine types for StoreAudit AI scanners.
 * Scanners feed data into rules; rules return DetectedIssue values.
 */

/** Audit category for a rule or detected issue. */
export type IssueCategory =
  | "PERFORMANCE"
  | "SEO"
  | "ACCESSIBILITY"
  | "THEME"
  | "PRODUCT"
  | "IMAGE"
  | "SCRIPT"
  | "UX";

/** Severity assigned to a rule finding. */
export type IssueSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFO";

/** How confident the rule is in the finding. */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/**
 * A single problem found by a rule evaluation.
 * Rules may return zero or more of these per run.
 */
export interface DetectedIssue {
  /** Rule that produced this issue (mirrors ScanRule.id). */
  ruleId: string;
  title: string;
  description?: string;
  category: IssueCategory;
  severity: IssueSeverity;
  confidence: ConfidenceLevel;
  /** Optional resource identifier (product GID, asset path, URL, etc.). */
  affectedResource?: string;
  affectedResourceType?: string;
  recommendation?: string;
  /** Arbitrary structured context for later persistence or UI. */
  metadata?: Record<string, unknown>;
}

/**
 * Outcome of evaluating one rule against scanner data.
 */
export interface RuleResult {
  ruleId: string;
  /** True when evaluation finished without throwing. */
  ok: boolean;
  issues: DetectedIssue[];
  /** Present when ok is false. */
  error?: string;
  /** Optional rule-level notes (timings, skipped reason, etc.). */
  meta?: Record<string, unknown>;
}

/**
 * Optional context passed to every rule in a runner invocation.
 */
export interface RuleContext {
  scanId?: string;
  shopDomain?: string;
  /** Free-form scanner/run metadata. */
  extras?: Record<string, unknown>;
}

/**
 * Independent, reusable audit rule.
 * Each scanner supplies its own data shape via TData.
 */
export interface ScanRule<TData = unknown> {
  /** Stable unique identifier, e.g. "image.missing-alt". */
  id: string;
  name: string;
  category: IssueCategory;
  defaultSeverity: IssueSeverity;
  description?: string;
  /**
   * Evaluate scanner data and return zero or more detected issues.
   * May be sync or async.
   */
  evaluate: (
    data: TData,
    context?: RuleContext
  ) => RuleResult | DetectedIssue[] | Promise<RuleResult | DetectedIssue[]>;
}

/** Normalized severity order for sorting / aggregation helpers. */
export const ISSUE_SEVERITY_ORDER: readonly IssueSeverity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
] as const;

export const ISSUE_CATEGORIES: readonly IssueCategory[] = [
  "PERFORMANCE",
  "SEO",
  "ACCESSIBILITY",
  "THEME",
  "PRODUCT",
  "IMAGE",
  "SCRIPT",
  "UX",
] as const;
