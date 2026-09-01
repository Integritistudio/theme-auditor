import { aiEnv } from "./env.ts";
import { countRecentAiAnalysesForShop } from "../db/repositories/ai-analyses.repository.ts";

export class AiRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "AiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** In-memory lock to prevent concurrent analyses for the same shop. */
const shopLocks = new Map<string, number>();

const LOCK_TTL_MS = 5 * 60 * 1000;

export function acquireShopAiLock(shopId: string): boolean {
  const now = Date.now();
  const existing = shopLocks.get(shopId);
  if (existing && now - existing < LOCK_TTL_MS) {
    return false;
  }
  shopLocks.set(shopId, now);
  return true;
}

export function releaseShopAiLock(shopId: string): void {
  shopLocks.delete(shopId);
}

/**
 * Enforces per-shop hourly analysis quota (DB-backed) + in-process concurrency lock.
 */
export async function assertAiRateLimitAllowed(shopId: string): Promise<void> {
  if (!acquireShopAiLock(shopId)) {
    throw new AiRateLimitError(
      "An AI analysis is already running for this shop. Try again shortly.",
      60
    );
  }

  try {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await countRecentAiAnalysesForShop(shopId, since);
    if (recent >= aiEnv.AI_RATE_LIMIT_PER_HOUR) {
      releaseShopAiLock(shopId);
      throw new AiRateLimitError(
        `AI analysis rate limit reached (${aiEnv.AI_RATE_LIMIT_PER_HOUR}/hour).`,
        3600
      );
    }
  } catch (error) {
    if (error instanceof AiRateLimitError) throw error;
    releaseShopAiLock(shopId);
    throw error;
  }
}
