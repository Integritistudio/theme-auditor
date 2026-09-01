import { aiEnv, getConfiguredModels, getPrimaryModel } from "./env.ts";

export class AiProviderError extends Error {
  statusCode?: number;
  cause?: unknown;

  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message);
    this.name = "AiProviderError";
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

export interface AiChatCompletionResult {
  content: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/**
 * Provider-agnostic chat completion used by AI analysis.
 */
export async function createChatCompletion(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<AiChatCompletionResult> {
  if (aiEnv.AI_PROVIDER === "gemini") {
    return createGeminiCompletion(options);
  }
  return createOpenAiCompletion(options);
}

async function createOpenAiCompletion(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<AiChatCompletionResult> {
  const apiKey = aiEnv.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError("OPENAI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    aiEnv.AI_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${aiEnv.OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiEnv.OPENAI_MODEL,
        temperature: options.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail =
        typeof body?.error?.message === "string"
          ? body.error.message
          : `HTTP ${response.status}`;
      throw new AiProviderError(
        `AI provider request failed: ${detail}`,
        response.status,
        body
      );
    }

    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new AiProviderError("AI provider returned an empty response.");
    }

    return {
      content,
      model: body?.model || aiEnv.OPENAI_MODEL,
      promptTokens:
        typeof body?.usage?.prompt_tokens === "number"
          ? body.usage.prompt_tokens
          : null,
      completionTokens:
        typeof body?.usage?.completion_tokens === "number"
          ? body.usage.completion_tokens
          : null,
    };
  } catch (error) {
    throw normalizeProviderError(error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls Gemini generateContent, trying each configured model in order.
 */
async function createGeminiCompletion(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<AiChatCompletionResult> {
  const apiKey = aiEnv.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError("GEMINI_API_KEY is not configured.");
  }

  const models = getConfiguredModels();
  const errors: string[] = [];

  for (const model of models) {
    try {
      return await callGeminiModel(model, apiKey, options);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Gemini error";
      errors.push(`${model}: ${message}`);
      console.warn(`⚠️ Gemini model ${model} failed: ${message}`);
    }
  }

  throw new AiProviderError(
    `All Gemini models failed (${models.join(", ")}). ${errors.join(" | ")}`
  );
}

async function callGeminiModel(
  model: string,
  apiKey: string,
  options: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
  }
): Promise<AiChatCompletionResult> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    aiEnv.AI_REQUEST_TIMEOUT_MS
  );

  const url = `${aiEnv.GEMINI_BASE_URL}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: options.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: options.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail =
        typeof body?.error?.message === "string"
          ? body.error.message
          : `HTTP ${response.status}`;
      throw new AiProviderError(
        `Gemini request failed: ${detail}`,
        response.status,
        body
      );
    }

    const parts = body?.candidates?.[0]?.content?.parts;
    const content = Array.isArray(parts)
      ? parts
          .map((part: { text?: string }) =>
            typeof part?.text === "string" ? part.text : ""
          )
          .join("")
          .trim()
      : "";

    if (!content) {
      const blockReason = body?.promptFeedback?.blockReason;
      throw new AiProviderError(
        blockReason
          ? `Gemini returned no content (blocked: ${blockReason}).`
          : "Gemini returned an empty response."
      );
    }

    return {
      content,
      model: body?.modelVersion || model || getPrimaryModel(),
      promptTokens:
        typeof body?.usageMetadata?.promptTokenCount === "number"
          ? body.usageMetadata.promptTokenCount
          : null,
      completionTokens:
        typeof body?.usageMetadata?.candidatesTokenCount === "number"
          ? body.usageMetadata.candidatesTokenCount
          : null,
    };
  } catch (error) {
    throw normalizeProviderError(error);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AiProviderError(
      `AI provider timed out after ${aiEnv.AI_REQUEST_TIMEOUT_MS}ms.`
    );
  }
  return new AiProviderError(
    error instanceof Error ? error.message : "AI provider request failed.",
    undefined,
    error
  );
}
