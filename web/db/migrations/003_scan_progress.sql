-- Migration: 003_scan_progress.sql
-- Description: Add progress tracking and failure details to scans

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(50)
    CHECK (
      progress_stage IS NULL
      OR progress_stage IN (
        'STORE_DATA',
        'PRODUCTS',
        'THEME',
        'STOREFRONT',
        'ANALYSIS',
        'COMPLETED'
      )
    ),
  ADD COLUMN IF NOT EXISTS progress_percent INT NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_scans_progress_stage ON scans(progress_stage);
