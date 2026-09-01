import {
  getAiAnalysisByScanId,
  upsertAiAnalysis,
  updateAiAnalysisStatus,
  type AiAnalysis,
} from "../db/repositories/ai-analyses.repository.ts";
import { getScanById } from "../db/repositories/scans.repository.ts";
import { buildAiAnalysisContext } from "./context.ts";
import { aiEnv, getPrimaryModel, isAiConfigured } from "./env.ts";
import { createChatCompletion, AiProviderError } from "./provider.ts";
import {
  assertAiRateLimitAllowed,
  releaseShopAiLock,
  AiRateLimitError,
} from "./rate-limit.ts";
import {
  AiAnalysisResultSchema,
  enforceKnownIssueIds,
  type AiAnalysisContext,
  type AiAnalysisResult,
} from "./schemas.ts";

export class AiAnalysisError extends Error {
  code:
    | "NOT_CONFIGURED"
    | "RATE_LIMIT"
    | "VALIDATION"
    | "PROVIDER"
    | "SCAN_STATE"
    | "UNKNOWN";

  constructor(
    message: string,
    code:
      | "NOT_CONFIGURED"
      | "RATE_LIMIT"
      | "VALIDATION"
      | "PROVIDER"
      | "SCAN_STATE"
      | "UNKNOWN" = "UNKNOWN"
  ) {
    super(message);
    this.name = "AiAnalysisError";
    this.code = code;
  }
}

const SYSTEM_PROMPT = `You are a Shopify store audit analyst.
You MUST ONLY discuss issues provided in the JSON input.
You MUST NOT invent, invent titles for, or add new issues, products, pages, or findings.
Every issueId you reference MUST exactly match an id from highPriorityIssues.
If there are fewer than 3 issues, return fewer topThreePriorities.
Respond with a single JSON object matching this shape:
{
  "executiveSummary": string,
  "topThreePriorities": [{ "rank": 1|2|3, "issueId": uuid, "title": string, "whyItMatters": string }],
  "explanations": [{ "issueId": uuid, "plainEnglish": string }],
  "recommendedActions": [{ "issueId": uuid, "action": string, "effort": "low"|"medium"|"high" }],
  "quickWins": [{ "issueId": uuid, "action": string }]
}
Be concrete and practical. Prefer low-effort quick wins when justified by the given issues.`;

function buildUserPrompt(context: AiAnalysisContext): string {
  return [
    "Analyze ONLY the following structured audit data from our deterministic rule engine.",
    "Do not invent issues beyond this list.",
    "",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function parseAndValidateResult(
  rawContent: string,
  allowedIssueIds: Set<string>
): AiAnalysisResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    throw new AiAnalysisError(
      "AI returned non-JSON content.",
      "VALIDATION"
    );
  }

  const validated = AiAnalysisResultSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AiAnalysisError(
      `AI response failed schema validation: ${validated.error.message}`,
      "VALIDATION"
    );
  }

  return enforceKnownIssueIds(validated.data, allowedIssueIds);
}

export interface RunAiAnalysisOptions {
  scanId: string;
  shopId: string;
  shopDomain?: string;
  /** When true, skip rate-limit count (still uses concurrency lock). */
  bypassHourlyQuota?: boolean;
}

/**
 * Runs AI analysis for a completed scan using only rule-engine issues.
 * Persists results in ai_analyses (never mutates issues rows).
 */
export async function runAiAnalysisForScan(
  options: RunAiAnalysisOptions
): Promise<AiAnalysis> {
  const { scanId, shopId, shopDomain } = options;

  if (!isAiConfigured()) {
    const skipped = await upsertAiAnalysis({
      scanId,
      shopId,
      status: "SKIPPED",
      provider: aiEnv.AI_PROVIDER,
      model: getPrimaryModel(),
      errorMessage: "AI is disabled or API key is not set.",
      result: null,
      completedAt: new Date(),
    });
    return skipped;
  }

  const scan = await getScanById(scanId);
  if (!scan) {
    throw new AiAnalysisError("Scan not found.", "SCAN_STATE");
  }
  if (scan.status !== "COMPLETED") {
    throw new AiAnalysisError(
      "AI analysis is only available for completed scans.",
      "SCAN_STATE"
    );
  }

  try {
    await assertAiRateLimitAllowed(shopId);
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      throw new AiAnalysisError(error.message, "RATE_LIMIT");
    }
    throw error;
  }

  try {
    const context = await buildAiAnalysisContext({ scanId, shopDomain });
    const allowedIssueIds = new Set(
      context.highPriorityIssues.map((issue) => issue.id)
    );

    await upsertAiAnalysis({
      scanId,
      shopId,
      status: "RUNNING",
      provider: aiEnv.AI_PROVIDER,
      model: getPrimaryModel(),
      inputSnapshot: context as unknown as Record<string, unknown>,
      result: null,
      errorMessage: null,
      completedAt: null,
    });

    // No high-priority issues → deterministic empty analysis without calling the provider.
    if (context.highPriorityIssues.length === 0) {
      const emptyResult: AiAnalysisResult = {
        executiveSummary:
          "No high-priority issues were detected by the rule engine for this scan. Store health scores are available from the deterministic scoring engine; no AI issue narrative is required.",
        topThreePriorities: [],
        explanations: [],
        recommendedActions: [],
        quickWins: [],
      };

      const saved = await updateAiAnalysisStatus(scanId, "COMPLETED", {
        result: emptyResult as unknown as Record<string, unknown>,
        errorMessage: null,
        promptTokens: 0,
        completionTokens: 0,
        provider: aiEnv.AI_PROVIDER,
        model: getPrimaryModel(),
      });
      return saved!;
    }

    let completion;
    try {
      completion = await createChatCompletion({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(context),
      });
    } catch (error) {
      const message =
        error instanceof AiProviderError
          ? error.message
          : "AI provider request failed.";
      await updateAiAnalysisStatus(scanId, "FAILED", {
        errorMessage: message,
        result: null,
      });
      throw new AiAnalysisError(message, "PROVIDER");
    }

    let analysisResult: AiAnalysisResult;
    try {
      analysisResult = parseAndValidateResult(
        completion.content,
        allowedIssueIds
      );
    } catch (error) {
      // One repair attempt: ask model to fix JSON against schema constraints.
      if (
        error instanceof AiAnalysisError &&
        error.code === "VALIDATION"
      ) {
        try {
          const repair = await createChatCompletion({
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: [
              buildUserPrompt(context),
              "",
              "Your previous response was invalid. Return corrected JSON only.",
              `Validation error: ${error.message}`,
              "Previous response:",
              completion.content.slice(0, 8000),
            ].join("\n"),
            temperature: 0,
          });
          analysisResult = parseAndValidateResult(
            repair.content,
            allowedIssueIds
          );
          completion = repair;
        } catch (repairError) {
          const message =
            repairError instanceof Error
              ? repairError.message
              : "AI response validation failed.";
          await updateAiAnalysisStatus(scanId, "FAILED", {
            errorMessage: message,
            result: null,
            promptTokens: completion.promptTokens,
            completionTokens: completion.completionTokens,
          });
          throw new AiAnalysisError(message, "VALIDATION");
        }
      } else {
        throw error;
      }
    }

    const saved = await updateAiAnalysisStatus(scanId, "COMPLETED", {
      result: analysisResult as unknown as Record<string, unknown>,
      errorMessage: null,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      provider: aiEnv.AI_PROVIDER,
      model: completion.model,
    });

    return saved!;
  } finally {
    releaseShopAiLock(shopId);
  }
}

/**
 * Fire-and-forget AI analysis after a scan completes.
 */
export function enqueueAiAnalysis(options: RunAiAnalysisOptions): void {
  setImmediate(() => {
    void runAiAnalysisForScan(options).catch((error) => {
      console.error(
        `❌ AI analysis failed for scan ${options.scanId}:`,
        error instanceof Error ? error.message : error
      );
    });
  });
}

export async function getAiAnalysisForScan(
  scanId: string
): Promise<AiAnalysis | null> {
  return getAiAnalysisByScanId(scanId);
}
