/**
 * Tells the database who is asking.
 *
 * The scoped repository is the primary control and stays that way: every
 * customer- and vendor-facing query applies its own `WHERE`. This is the layer
 * underneath, for the day one of those queries is written without it. Row-level
 * security cannot help unless Postgres knows the actor, and Postgres only knows
 * what the connection tells it — so a customer or vendor request runs on a
 * reserved connection with three settings applied, and the policies in
 * migration 0005 read them.
 *
 * Two deliberate limits:
 *
 *   - **Only the personal surfaces.** Ops, the public catalogue, the jobs and
 *     the seed run without an actor, and the policies allow everything when the
 *     settings are absent. Ops genuinely reads across customers; that is the
 *     job. Constraining it here would mean granting it back immediately.
 *
 *   - **A reserved connection, not a transaction.** Wrapping every read in a
 *     transaction would hold locks for the length of a page render. Reserving
 *     borrows a connection from the pool and returns it, which costs pool
 *     capacity while the request runs and nothing else.
 *
 * The handle travels through AsyncLocalStorage rather than through arguments.
 * Threading a connection through ninety repository functions would be a large
 * change to a layer that works, and every one of those signatures would be a
 * place for a future query to quietly use the unscoped pool instead.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "../lib/config";
import * as schema from "./schema";
import { registerScopeResolver, sql as pool, type Database } from "./client";

/** Who the current request belongs to, as the database needs to see it. */
export interface DatabaseActor {
  userId: string;
  clientId?: string | null;
  professionalId?: string | null;
}

const store = new AsyncLocalStorage<Database>();

/** The connection the current request should use, if it reserved one. */
export function scopedDatabase(): Database | undefined {
  return store.getStore();
}

// Registered on import, so `db` starts resolving to the request's connection as
// soon as this module is loaded. `app.ts` imports it explicitly for that reason.
registerScopeResolver(scopedDatabase);

/** A reserved connection carrying an actor, and the way to give it back. */
export interface ActorScope {
  database: Database;
  release: () => Promise<void>;
}

/**
 * Reserves a connection and tells it who the actor is.
 *
 * `set_config(..., false)` is session-scoped rather than transaction-scoped,
 * which is why `release` clears the settings before handing the connection
 * back. A pooled connection still carrying the last person's identity would be
 * a far worse bug than the one this guards against.
 */
export async function openScope(actor: DatabaseActor): Promise<ActorScope> {
  const reserved = await pool.reserve();

  try {
    await reserved`SELECT
      set_config('app.user_id', ${actor.userId}, false),
      set_config('app.client_id', ${actor.clientId ?? ""}, false),
      set_config('app.professional_id', ${actor.professionalId ?? ""}, false)`;
  } catch (error) {
    reserved.release();
    throw error;
  }

  /**
   * A reserved connection is a callable without the `options` the driver adapter
   * reads its type parsers from — the parent pool holds those. Lending them to
   * the reservation is what lets drizzle wrap it; without this every query on a
   * scoped connection fails on an undefined `parsers`.
   */
  if (!(reserved as { options?: unknown }).options) {
    Object.defineProperty(reserved, "options", { value: pool.options, configurable: true });
  }

  return {
    database: drizzle(reserved, { schema, logger: config.LOG_LEVEL === "trace" }) as Database,
    release: async () => {
      try {
        await reserved`SELECT
          set_config('app.user_id', '', false),
          set_config('app.client_id', '', false),
          set_config('app.professional_id', '', false)`;
      } finally {
        reserved.release();
      }
    },
  };
}

/**
 * Runs the rest of the request inside the scope.
 *
 * `next` is called *within* `store.run`, which is what carries the context into
 * everything that follows. Returning from a hook that had opened a scope would
 * leave the handler outside it, and `db` would quietly resolve to the pool —
 * the failure being that row-level security silently does nothing.
 */
export function runInScope(database: Database, next: () => void): void {
  store.run(database, next);
}

/**
 * Runs `work` against a specific handle. For the staff pool, and for scripts
 * that need to measure what a request would actually do.
 */
export async function withDatabase<T>(database: Database, work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    store.run(database, () => {
      work().then(resolve, reject);
    });
  });
}

/** Runs one function inside a scope. For jobs, tests and scripts. */
export async function withActor<T>(actor: DatabaseActor, work: () => Promise<T>): Promise<T> {
  const scope = await openScope(actor);
  try {
    return await new Promise<T>((resolve, reject) => {
      store.run(scope.database, () => {
        work().then(resolve, reject);
      });
    });
  } finally {
    await scope.release();
  }
}
