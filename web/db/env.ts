import { z } from "zod";
import dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), "../.env") });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL environment variable is required.")
    .refine((url) => url.startsWith("postgres://") || url.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a valid PostgreSQL connection URL.",
    }),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Environment validation error:", parsedEnv.error.format());
  throw new Error("Invalid environment variables. Please check your .env configuration.");
}

export const env = parsedEnv.data;
