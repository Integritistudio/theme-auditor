import type {
  DetectedIssue,
  RuleContext,
  RuleResult,
  ScanRule,
} from "./types.ts";

export interface RunRulesOptions {
  /** Stop evaluating remaining rules after the first thrown/failed rule. */
  stopOnError?: boolean;
  context?: RuleContext;
}

export interface RunRulesSummary {
  results: RuleResult[];
  issues: DetectedIssue[];
  rulesRun: number;
  rulesFailed: number;
}

function isRuleResult(value: unknown): value is RuleResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "ruleId" in value &&
    "issues" in value &&
    Array.isArray((value as RuleResult).issues)
  );
}

/**
 * Normalizes a rule's raw return value into a RuleResult.
 */
export function normalizeRuleResult(
  rule: ScanRule<unknown>,
  raw: RuleResult | DetectedIssue[]
): RuleResult {
  if (isRuleResult(raw)) {
    return {
      ...raw,
      ruleId: raw.ruleId || rule.id,
      ok: raw.ok !== false,
      issues: Array.isArray(raw.issues) ? raw.issues : [],
    };
  }

  return {
    ruleId: rule.id,
    ok: true,
    issues: raw,
  };
}

/**
 * Ensures each issue carries the rule id and fills severity/category defaults.
 */
export function enrichIssues(
  rule: ScanRule<unknown>,
  issues: DetectedIssue[]
): DetectedIssue[] {
  return issues.map((issue) => ({
    ...issue,
    ruleId: issue.ruleId || rule.id,
    category: issue.category || rule.category,
    severity: issue.severity || rule.defaultSeverity,
  }));
}

/**
 * Runs a single rule safely; evaluation errors become a failed RuleResult.
 */
export async function runRule<TData>(
  rule: ScanRule<TData>,
  data: TData,
  context?: RuleContext
): Promise<RuleResult> {
  try {
    const raw = await rule.evaluate(data, context);
    const normalized = normalizeRuleResult(
      rule as ScanRule<unknown>,
      raw
    );
    return {
      ...normalized,
      issues: enrichIssues(rule as ScanRule<unknown>, normalized.issues),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rule evaluation failed";
    return {
      ruleId: rule.id,
      ok: false,
      issues: [],
      error: message,
    };
  }
}

/**
 * Executes an independent set of rules against the same scanner data payload.
 * Rules do not share state; failures are isolated unless stopOnError is set.
 */
export async function runRules<TData>(
  rules: readonly ScanRule<TData>[],
  data: TData,
  options: RunRulesOptions = {}
): Promise<RunRulesSummary> {
  const results: RuleResult[] = [];
  let rulesFailed = 0;

  for (const rule of rules) {
    const result = await runRule(rule, data, options.context);
    results.push(result);

    if (!result.ok) {
      rulesFailed += 1;
      if (options.stopOnError) {
        break;
      }
    }
  }

  const issues = results.flatMap((result) => result.issues);

  return {
    results,
    issues,
    rulesRun: results.length,
    rulesFailed,
  };
}

/**
 * Convenience helper: run rules and return only flattened detected issues.
 */
export async function collectIssues<TData>(
  rules: readonly ScanRule<TData>[],
  data: TData,
  options: RunRulesOptions = {}
): Promise<DetectedIssue[]> {
  const summary = await runRules(rules, data, options);
  return summary.issues;
}
