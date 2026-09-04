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
  /**
   * Raised because a customer or vendor request reserves a connection for its
   * whole life, so in-flight personal requests and pool size are now the same
   * number. Ten was chosen against Railway's hundred-connection limit with
   * several instances, migrations and a psql session in mind; that still holds.
   */
  max: config.isTest ? 6 : 10,
  idle_timeout: 30,
  connect_timeout: 10,
  // Every timestamp on the wire is UTC; formatting for IST is the frontend's job.
  types: {},
  onnotice: config.isProduction ? () => {} : undefined,
});

const pooled = drizzle(sql, { schema, logger: config.LOG_LEVEL === "trace" });

export type Database = typeof pooled;

/**
 * Set by `actor-context` when it loads. Left undefined here so this module
 * imports nothing from it — the two would otherwise import each other, and a
 * cycle whose resolution order decides whether row-level security is active is
 * not something to leave to chance.
 */
let scopeResolver: (() => Database | undefined) | undefined;

export function registerScopeResolver(resolver: () => Database | undefined): void {
  scopeResolver = resolver;
}

/**
 * The database handle.
 *
 * Normally the pool. Inside a customer or vendor request it is that request's
 * reserved connection, which carries the actor's identity and is therefore
 * subject to the row-level security policies. Every existing call site gets
 * that for free rather than having a connection threaded through it.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const active = scopeResolver?.() ?? pooled;
    const value = Reflect.get(active as object, property, receiver);
    return typeof value === "function" ? value.bind(active) : value;
  },
});

/** The pool itself, for the few places that must not be scoped. */
export const unscopedDb = pooled;

/**
 * The staff pool.
 *
 * A separate connection as a role that bypasses row-level security, because
 * staff queries are global by design and were paying for a policy that passed
 * every row. Falls back to the main pool when unconfigured — correct either
 * way, only slower.
 */
const opsSql = config.OPS_DATABASE_URL
  ? postgres(config.OPS_DATABASE_URL, {
      max: config.isTest ? 3 : 6,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: config.isProduction ? () => {} : undefined,
    })
  : null;

export const opsDb: Database = opsSql
  ? drizzle(opsSql, { schema, logger: config.LOG_LEVEL === "trace" })
  : pooled;
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
  await Promise.all([sql.end({ timeout: 5 }), opsSql?.end({ timeout: 5 })]);
}

export { schema };
