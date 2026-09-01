-- Migration: 004_ai_analyses.sql
-- Description: Store AI analysis separately from rule-engine detected issues

CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  provider VARCHAR(100),
  model VARCHAR(100),
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  prompt_tokens INT,
  completion_tokens INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- One analysis row per scan (regenerate updates the same row)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analyses_scan_id ON ai_analyses(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_shop_id ON ai_analyses(shop_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_status ON ai_analyses(status);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_created_at ON ai_analyses(created_at DESC);
