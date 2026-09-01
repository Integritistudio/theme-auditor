import pg from "pg";
import { env } from "./env.ts";

const { Pool } = pg;

// Prevent creating multiple Pool instances in development due to nodemon hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __storeAuditPgPool: pg.Pool | undefined;
}

let pool: pg.Pool;

if (env.NODE_ENV === "production") {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
} else {
  if (!globalThis.__storeAuditPgPool) {
    globalThis.__storeAuditPgPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  pool = globalThis.__storeAuditPgPool;
}

pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle PostgreSQL client pool connection:", err);
});

/**
 * Execute a parameterized SQL query against the PostgreSQL pool.
 * @param text SQL query string with parameter placeholders ($1, $2, etc.)
 * @param params Array of parameter values matching the placeholders
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default pool;
