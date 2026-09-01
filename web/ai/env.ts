import { z } from "zod";
import dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), "../.env") });
dotenv.config();

const aiEnvSchema = z.object({
  AI_ENABLED: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return true;
      return v === "1" || v.toLowerCase() === "true";
    }),
  AI_PROVIDER: z.enum(["openai", "gemini"]).default("gemini"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z
    .string()
    .optional()
    .transform((v) => {
      const fallback = "https://api.openai.com/v1";
      if (!v || !v.trim()) return fallback;
      try {
        // eslint-disable-next-line no-new
        new URL(v);
        return v.replace(/\/$/, "");
      } catch {
        return fallback;
      }
    }),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODELS: z
    .string()
    .optional()
    .transform((v) => {
      const defaults = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];
      if (!v || !v.trim()) return defaults;
      const models = v
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      return models.length > 0 ? models : defaults;
    }),
  GEMINI_BASE_URL: z
    .string()
    .optional()
    .transform((v) => {
      const fallback = "https://generativelanguage.googleapis.com/v1beta";
      if (!v || !v.trim()) return fallback;
      try {
        // eslint-disable-next-line no-new
        new URL(v);
        return v.replace(/\/$/, "");
      } catch {
        return fallback;
      }
    }),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(1000).default(10),
  AI_MAX_HIGH_PRIORITY_ISSUES: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(15),
  AI_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5000)
    .max(180000)
    .default(60000),
});

const parsed = aiEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "⚠️ Invalid AI environment variables; AI analysis disabled.",
    parsed.error.format()
  );
}

export const aiEnv = parsed.success
  ? parsed.data
  : {
      AI_ENABLED: false,
      AI_PROVIDER: "gemini" as const,
      OPENAI_API_KEY: undefined,
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-4o-mini",
      GEMINI_API_KEY: undefined,
      GEMINI_MODELS: ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"],
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta",
      AI_RATE_LIMIT_PER_HOUR: 10,
      AI_MAX_HIGH_PRIORITY_ISSUES: 15,
      AI_REQUEST_TIMEOUT_MS: 60000,
    };

export function getConfiguredModels(): string[] {
  if (aiEnv.AI_PROVIDER === "gemini") {
    return aiEnv.GEMINI_MODELS;
  }
  return [aiEnv.OPENAI_MODEL];
}

export function getPrimaryModel(): string {
  return getConfiguredModels()[0] || "unknown";
}

export function isAiConfigured(): boolean {
  if (!aiEnv.AI_ENABLED) return false;
  if (aiEnv.AI_PROVIDER === "gemini") {
    return Boolean(aiEnv.GEMINI_API_KEY?.trim());
  }
  return Boolean(aiEnv.OPENAI_API_KEY?.trim());
}
