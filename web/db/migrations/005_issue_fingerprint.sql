-- Migration: 005_issue_fingerprint.sql
-- Description: Stable issue fingerprints for cross-scan comparison

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- Backfill approximate fingerprints for existing rows (refined by app logic on insert/compare)
UPDATE issues
SET fingerprint =
  lower(trim(rule_id))
  || '|'
  || lower(trim(COALESCE(NULLIF(affected_resource, ''), 'no-resource')))
  || '|'
  || lower(
       trim(
         COALESCE(
           NULLIF(metadata->>'fingerprint', ''),
           NULLIF(metadata->>'stableId', ''),
           NULLIF(metadata->>'selector', ''),
           NULLIF(metadata->>'fileKey', ''),
           NULLIF(metadata->>'scriptUrl', ''),
           NULLIF(metadata->>'pageUrl', ''),
           NULLIF(metadata->>'pageType', ''),
           NULLIF(metadata->>'imageSrc', ''),
           NULLIF(metadata->>'href', ''),
           NULLIF(
             regexp_replace(lower(COALESCE(title, '')), '[^a-z0-9]+', '-', 'g'),
             ''
           ),
           'unknown'
         )
       )
     )
WHERE fingerprint IS NULL OR trim(fingerprint) = '';

CREATE INDEX IF NOT EXISTS idx_issues_fingerprint ON issues(fingerprint);
CREATE INDEX IF NOT EXISTS idx_issues_scan_fingerprint ON issues(scan_id, fingerprint);
