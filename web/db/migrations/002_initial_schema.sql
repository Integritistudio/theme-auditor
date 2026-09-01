-- Migration: 002_initial_schema.sql
-- Description: Create initial schema for StoreAudit AI (shops, scans, issues)

-- Enable pgcrypto extension for gen_random_uuid() if required
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Shops Table
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_domain VARCHAR(255) UNIQUE NOT NULL,
  shopify_shop_id VARCHAR(255) UNIQUE,
  access_token TEXT,
  plan VARCHAR(50) DEFAULT 'free' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Scans Table
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  overall_score INT DEFAULT 0,
  performance_score INT DEFAULT 0,
  seo_score INT DEFAULT 0,
  accessibility_score INT DEFAULT 0,
  theme_score INT DEFAULT 0,
  product_score INT DEFAULT 0,
  total_issues INT DEFAULT 0,
  critical_issues INT DEFAULT 0,
  high_issues INT DEFAULT 0,
  medium_issues INT DEFAULT 0,
  low_issues INT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Issues Table
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  rule_id VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(50) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  impact_score INT DEFAULT 0,
  confidence_score INT DEFAULT 0,
  affected_resource TEXT,
  affected_resource_type VARCHAR(100),
  recommendation TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance and lookup optimization

-- Shops indexes
CREATE INDEX IF NOT EXISTS idx_shops_shopify_domain ON shops(shopify_domain);

-- Scans indexes
CREATE INDEX IF NOT EXISTS idx_scans_shop_id ON scans(shop_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- Issues indexes
CREATE INDEX IF NOT EXISTS idx_issues_scan_id ON issues(scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_metadata_gin ON issues USING GIN (metadata);
