import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let connection: ReturnType<typeof postgres> | null = null;

/**
 * Get a Drizzle ORM database instance.
 * Uses a lazy singleton — one connection per process.
 *
 * @param connectionString - Postgres connection URL (defaults to DATABASE_URL env var)
 */
export function getDb(connectionString?: string) {
  if (!db) {
    const url = connectionString ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL environment variable is required. Pass it explicitly or set it in .env",
      );
    }
    connection = postgres(url);
    db = drizzle(connection, { schema });
  }
  return db;
}

/**
 * Close the database connection. Call on process shutdown.
 */
export async function closeDb() {
  if (connection) {
    await connection.end();
    connection = null;
    db = null;
  }
}
