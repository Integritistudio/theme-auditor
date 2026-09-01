import fs from "fs";
import path from "path";
import pool from "./client.ts";

/**
 * Runs all pending SQL migrations in sequential order.
 * Ensures each migration is executed within a database transaction and logged to schema_migrations.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("🔄 Starting database migration runner...");

    // 1. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Query already executed migrations
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations;"
    );
    const executedMigrations = new Set(rows.map((row) => row.name));

    // 3. Locate migration files in web/db/migrations
    const migrationsDir = path.join(process.cwd(), "db", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("ℹ️ No migration files found in:", migrationsDir);
      return;
    }

    let appliedCount = 0;

    // 4. Sequentially execute pending migrations wrapped in transactions
    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`⏩ Already applied: ${file}`);
        continue;
      }

      console.log(`⏳ Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      try {
        await client.query("BEGIN");
        if (sql.trim().length > 0) {
          await client.query(sql);
        }
        await client.query(
          "INSERT INTO schema_migrations (name) VALUES ($1);",
          [file]
        );
        await client.query("COMMIT");
        appliedCount++;
        console.log(`✅ Applied migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`❌ Migration failed on ${file}:`, error);
        throw error;
      }
    }

    console.log(
      `🎉 Migration runner completed successfully. (${appliedCount} new migration(s) executed)`
    );
  } finally {
    client.release();
  }
}
