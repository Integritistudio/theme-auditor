/**
 * Stable issue fingerprinting for cross-scan comparison.
 *
 * fingerprint = ruleId + affectedResource + normalizedIssueIdentifier
 *
 * Do not use database issue UUIDs — each scan inserts new rows.
 */

const METADATA_ID_KEYS = [
  "fingerprint",
  "stableId",
  "selector",
  "fileKey",
  "scriptUrl",
  "pageUrl",
  "pageType",
  "duplicateOf",
  "imageSrc",
  "href",
  "classification",
] as const;

export interface FingerprintInput {
  ruleId: string;
  title?: string | null;
  affectedResource?: string | null;
  affectedResourceType?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function normalizeFingerprintToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\|/g, "/")
    .slice(0, 300);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "untitled").slice(0, 120);
}

/**
 * Picks a stable secondary identifier that survives across scans.
 */
export function deriveNormalizedIssueIdentifier(
  input: FingerprintInput
): string {
  const metadata = input.metadata || {};

  for (const key of METADATA_ID_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      // classification alone is too coarse; skip unless no better id later
      if (key === "classification") continue;
      return normalizeFingerprintToken(value);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  if (typeof metadata.evidence === "string" && metadata.evidence.trim()) {
    return normalizeFingerprintToken(metadata.evidence).slice(0, 160);
  }

  if (
    typeof metadata.classification === "string" &&
    metadata.classification.trim() &&
    input.title
  ) {
    return normalizeFingerprintToken(
      `${metadata.classification}:${slugify(input.title)}`
    );
  }

  const typePart = input.affectedResourceType
    ? normalizeFingerprintToken(input.affectedResourceType)
    : "resource";
  const titlePart = slugify(input.title || input.ruleId || "issue");
  return `${typePart}:${titlePart}`;
}

/**
 * Builds the canonical fingerprint string used for scan diffs.
 */
export function buildIssueFingerprint(input: FingerprintInput): string {
  const ruleId = normalizeFingerprintToken(input.ruleId || "unknown-rule");
  const resource = normalizeFingerprintToken(
    input.affectedResource?.trim() ? input.affectedResource : "no-resource"
  );
  const identifier = deriveNormalizedIssueIdentifier(input);
  return `${ruleId}|${resource}|${identifier}`;
}

export function fingerprintFromIssueRow(issue: {
  rule_id: string;
  title?: string | null;
  affected_resource?: string | null;
  affected_resource_type?: string | null;
  metadata?: Record<string, unknown> | null;
  fingerprint?: string | null;
}): string {
  if (issue.fingerprint && issue.fingerprint.trim()) {
    return issue.fingerprint.trim();
  }
  return buildIssueFingerprint({
    ruleId: issue.rule_id,
    title: issue.title,
    affectedResource: issue.affected_resource,
    affectedResourceType: issue.affected_resource_type,
    metadata: issue.metadata,
  });
}
