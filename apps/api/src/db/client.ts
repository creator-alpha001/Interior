/**
 * The database connection, and the transaction helper everything writes through.
 */
import { sql as raw } from "drizzle-orm";
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
/**
 * Marks a handle as a *reserved connection* rather than a pool.
 *
 * The distinction matters only to `transaction` below, and it cannot be
 * inferred: the resolver returns a reservation for a customer or vendor request
 * and the staff **pool** for an ops one, and the two need different transaction
 * machinery. Set by `openScope`, which is the only thing that makes a
 * reservation.
 */
export const RESERVED_CONNECTION = Symbol.for("aangan.reservedConnection");

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
 * How deep we are inside a hand-rolled transaction, per scoped handle.
 *
 * Keyed on the handle because it is created per request and thrown away with
 * it, so nothing accumulates. Nothing in the codebase nests today; this exists
 * so that the day something does, the inner call joins the outer transaction
 * instead of issuing a second BEGIN and committing its parent halfway through.
 */
const depth = new WeakMap<object, number>();

/**
 * Runs a unit of work atomically.
 *
 * Every multi-table mutation goes through here. Signing an agreement writes an
 * agreement, N projects, 4N milestones and an invoice; a partial failure there
 * leaves a customer with a signed contract and no project, which is worse than
 * the write failing outright.
 *
 * ---
 *
 * **Why this does not simply call `db.transaction`.**
 *
 * A customer or vendor request runs on a connection reserved by
 * `openScope`, so that the row-level security policies have an identity to read.
 * `postgres.reserve()` returns a bare `Sql` — `begin` is defined on the pool
 * object and is *not* carried onto a reservation — so drizzle's `transaction`,
 * which calls `client.begin(...)`, throws `this.client.begin is not a function`
 * on every scoped write.
 *
 * That broke every multi-table mutation on `/me` and `/vendor` the moment
 * row-level security was switched on, silently and completely:
 * `POST /me/agreements/:id/sign` — the largest transaction in the system, five
 * tables — answered 500 for every customer. The tests did not catch it because
 * they exercised the policies through *reads*, and the write path they did
 * cover ran outside a scope.
 *
 * BEGIN and COMMIT are issued by hand instead. Everything queued on a reserved
 * connection runs on that one connection in order, which is exactly what a
 * transaction needs, so this is the same guarantee by a different route.
 */
export async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  const active = scopeResolver?.() ?? pooled;

  /*
   * A pool — the default handle, the jobs, the seed, and staff requests, which
   * resolve to the bypassing ops pool rather than to a reservation. The
   * driver's own implementation works on all of these and is the one to use:
   * issuing BEGIN by hand against a *pool* would send it to whichever
   * connection happened to be free and leave the writes on another.
   */
  if (!(RESERVED_CONNECTION in active)) return active.transaction(work);

  const scoped = active;
  const outer = depth.get(scoped) ?? 0;
  // Already inside one: join it. Committing here would end the caller's
  // transaction while it still had work to do.
  if (outer > 0) return work(scoped as unknown as Tx);

  depth.set(scoped, 1);
  await scoped.execute(raw`begin`);

  try {
    const result = await work(scoped as unknown as Tx);
    await scoped.execute(raw`commit`);
    return result;
  } catch (error) {
    // Best effort, and deliberately not allowed to mask the real failure: if
    // the connection is already in an aborted transaction, the ROLLBACK is
    // what clears it, and if it fails there is nothing better to report than
    // what went wrong in the first place.
    await scoped.execute(raw`rollback`).catch(() => {});
    throw error;
  } finally {
    depth.set(scoped, 0);
  }
}

export async function closeDatabase(): Promise<void> {
  await Promise.all([sql.end({ timeout: 5 }), opsSql?.end({ timeout: 5 })]);
}

export { schema };
