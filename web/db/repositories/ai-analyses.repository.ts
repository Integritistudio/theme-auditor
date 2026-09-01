import { query } from "../client.ts";

export type AiAnalysisStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export interface AiAnalysis {
  id: string;
  scan_id: string;
  shop_id: string;
  status: AiAnalysisStatus;
  provider: string | null;
  model: string | null;
  input_snapshot: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface UpsertAiAnalysisInput {
  scanId: string;
  shopId: string;
  status?: AiAnalysisStatus;
  provider?: string | null;
  model?: string | null;
  inputSnapshot?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  completedAt?: Date | null;
}

/**
 * Creates or replaces the AI analysis row for a scan (1:1 with scans).
 */
export async function upsertAiAnalysis(
  input: UpsertAiAnalysisInput
): Promise<AiAnalysis> {
  const result = await query<AiAnalysis>(
    `INSERT INTO ai_analyses (
       scan_id, shop_id, status, provider, model,
       input_snapshot, result, error_message,
       prompt_tokens, completion_tokens, completed_at, updated_at
     )
     VALUES (
       $1, $2, COALESCE($3, 'PENDING'), $4, $5,
       COALESCE($6::jsonb, '{}'::jsonb), $7, $8,
       $9, $10, $11, CURRENT_TIMESTAMP
     )
     ON CONFLICT (scan_id) DO UPDATE SET
       status = COALESCE(EXCLUDED.status, ai_analyses.status),
       provider = COALESCE(EXCLUDED.provider, ai_analyses.provider),
       model = COALESCE(EXCLUDED.model, ai_analyses.model),
       input_snapshot = COALESCE(EXCLUDED.input_snapshot, ai_analyses.input_snapshot),
       result = EXCLUDED.result,
       error_message = EXCLUDED.error_message,
       prompt_tokens = EXCLUDED.prompt_tokens,
       completion_tokens = EXCLUDED.completion_tokens,
       completed_at = EXCLUDED.completed_at,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *;`,
    [
      input.scanId,
      input.shopId,
      input.status || "PENDING",
      input.provider ?? null,
      input.model ?? null,
      JSON.stringify(input.inputSnapshot || {}),
      input.result != null ? JSON.stringify(input.result) : null,
      input.errorMessage ?? null,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.completedAt ?? null,
    ]
  );
  return result.rows[0];
}

export async function getAiAnalysisByScanId(
  scanId: string
): Promise<AiAnalysis | null> {
  const result = await query<AiAnalysis>(
    "SELECT * FROM ai_analyses WHERE scan_id = $1 LIMIT 1;",
    [scanId]
  );
  return result.rows[0] || null;
}

export async function updateAiAnalysisStatus(
  scanId: string,
  status: AiAnalysisStatus,
  extras: {
    errorMessage?: string | null;
    result?: Record<string, unknown> | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    provider?: string | null;
    model?: string | null;
    inputSnapshot?: Record<string, unknown>;
  } = {}
): Promise<AiAnalysis | null> {
  const completedAt =
    status === "COMPLETED" || status === "FAILED" || status === "SKIPPED"
      ? new Date()
      : null;

  const result = await query<AiAnalysis>(
    `UPDATE ai_analyses SET
       status = $2,
       error_message = $3,
       result = $4::jsonb,
       prompt_tokens = COALESCE($5, prompt_tokens),
       completion_tokens = COALESCE($6, completion_tokens),
       provider = COALESCE($7, provider),
       model = COALESCE($8, model),
       input_snapshot = COALESCE($9::jsonb, input_snapshot),
       completed_at = COALESCE($10, completed_at),
       updated_at = CURRENT_TIMESTAMP
     WHERE scan_id = $1
     RETURNING *;`,
    [
      scanId,
      status,
      extras.errorMessage ?? null,
      extras.result !== undefined
        ? extras.result != null
          ? JSON.stringify(extras.result)
          : null
        : null,
      extras.promptTokens ?? null,
      extras.completionTokens ?? null,
      extras.provider ?? null,
      extras.model ?? null,
      extras.inputSnapshot != null
        ? JSON.stringify(extras.inputSnapshot)
        : null,
      completedAt,
    ]
  );
  return result.rows[0] || null;
}

/**
 * Counts AI analysis attempts for a shop within a time window (rate limiting).
 */
export async function countRecentAiAnalysesForShop(
  shopId: string,
  since: Date
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count
     FROM ai_analyses
     WHERE shop_id = $1
       AND updated_at >= $2
       AND status IN ('RUNNING', 'COMPLETED', 'FAILED');`,
    [shopId, since]
  );
  return parseInt(result.rows[0]?.count || "0", 10);
}
