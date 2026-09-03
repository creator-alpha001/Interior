/**
 * The database connection, and the transaction helper everything writes through.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../lib/config";
import * as schema from "./schema";

/**
 * One pool for the process.
 *
 * `max: 10` against Railway's default 100-connection limit leaves room for
 * migrations, the job worker and a psql session while several API instances are
 * running. Raising it is rarely the fix for a slow endpoint.
 */
export const sql = postgres(config.DATABASE_URL, {
  max: config.isTest ? 2 : 10,
  idle_timeout: 30,
  connect_timeout: 10,
  // Every timestamp on the wire is UTC; formatting for IST is the frontend's job.
  types: {},
  onnotice: config.isProduction ? () => {} : undefined,
});

export const db = drizzle(sql, { schema, logger: config.LOG_LEVEL === "trace" });

export type Database = typeof db;
/** The handle a callback receives inside `transaction`. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Runs a unit of work atomically.
 *
 * Every multi-table mutation goes through here. Signing an agreement writes an
 * agreement, N projects, 4N milestones and an invoice; a partial failure there
 * leaves a customer with a signed contract and no project, which is worse than
 * the write failing outright.
 */
export async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(work);
}

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
}

export { schema };
