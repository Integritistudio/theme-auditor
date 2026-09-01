import { query } from "./client.ts";

export interface DatabaseHealthStatus {
  status: "ok" | "error";
  timestamp?: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Performs a simple database health check query (SELECT NOW()).
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  try {
    const result = await query<{ now: Date }>("SELECT NOW() as now;");
    const latencyMs = Date.now() - startTime;
    return {
      status: "ok",
      timestamp: result.rows[0]?.now?.toISOString(),
      latencyMs,
    };
  } catch (error: any) {
    console.error("❌ Database health check failed:", error);
    return {
      status: "error",
      error: error?.message || "Unknown database connection error",
    };
  }
}
