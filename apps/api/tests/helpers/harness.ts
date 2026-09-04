/**
 * Shared test machinery.
 *
 * Two ideas run through everything here. First, a constraint test must observe
 * the *database* refusing the write — asserting that a service function threw
 * only proves the service remembered, which is exactly the state the code was
 * in while several of these rules were being broken. Second, a test that leaves
 * rows behind turns the next test's failure into a mystery, so every write runs
 * inside a transaction that is always rolled back.
 *
 * Both helpers hand the callback a transaction handle. Using the pool instead
 * would run the statement outside the transaction, and the rollback would
 * quietly cover nothing.
 */
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { expect } from "vitest";
import { buildApp } from "../../src/app";
import { db, type Tx } from "../../src/db/client";
import { SESSION_COOKIE } from "../../src/modules/auth/sessions";

let cached: FastifyInstance | null = null;

/** One app for the file. `inject` needs no port, so there is nothing to clash. */
export async function app(): Promise<FastifyInstance> {
  if (!cached) cached = await buildApp();
  return cached;
}

/** Thrown to undo a transaction whose work succeeded. Never escapes. */
const ROLLBACK = Symbol("rollback");

/**
 * Runs `work` against a transaction and rolls it back, whatever happens.
 *
 * Used for writes expected to succeed that would otherwise pollute the shared
 * database — including the ones whose *effect* is the assertion, such as a
 * trigger firing.
 */
export async function rollingBack<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T;
  try {
    await db.transaction(async (tx) => {
      result = await work(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  return result!;
}

/**
 * Asserts that the database refuses `work`, and that the named rule is why.
 *
 * Matching the constraint name rather than "it threw" is the whole point: a
 * typo'd column also throws, and would otherwise be indistinguishable from the
 * rule holding. A test that passes for the wrong reason is worse than no test,
 * because it will keep passing after the rule is dropped.
 */
export async function refusedBy(constraint: string, work: (tx: Tx) => Promise<unknown>) {
  let caught: unknown;
  try {
    await db.transaction(async (tx) => {
      await work(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    caught = error;
  }

  if (caught === ROLLBACK || caught === undefined) {
    throw new Error(`Expected the database to refuse this, citing "${constraint}". It allowed it.`);
  }

  // Drizzle wraps the driver error, and the constraint name only appears on the
  // one underneath — so walk the chain rather than reading the top message.
  const haystack = reasons(caught).join(" | ");
  expect(
    haystack.includes(constraint),
    `Expected "${constraint}" to be the reason. Postgres said: ${haystack}`,
  ).toBe(true);
}

/** Every message, detail and constraint name down an error's `cause` chain. */
function reasons(error: unknown, depth = 0): string[] {
  if (!error || typeof error !== "object" || depth > 5) return [];
  const e = error as Error & { constraint_name?: string; detail?: string; cause?: unknown };
  return [e.message, e.constraint_name, e.detail]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .concat(reasons(e.cause, depth + 1));
}

/** Signs in as staff and returns the session cookie header. */
export async function staffSession(email: string): Promise<string> {
  const instance = await app();
  const response = await instance.inject({
    method: "POST",
    url: "/auth/staff/login",
    payload: { email, password: process.env.SEED_STAFF_PASSWORD ?? "aangan-dev-password" },
  });
  if (response.statusCode !== 200) {
    throw new Error(`Could not sign in as ${email}: ${response.statusCode} ${response.body}`);
  }
  return cookieFrom(response.headers["set-cookie"]);
}

/** Signs in by mobile, reading the code out of the development echo. */
export async function otpSession(mobile: string): Promise<string> {
  const instance = await app();
  const requested = await instance.inject({
    method: "POST",
    url: "/auth/otp/request",
    payload: { mobile },
  });
  const { challengeId, devCode } = requested.json<{ challengeId: string; devCode?: string }>();
  if (!devCode) throw new Error("OTP_DEV_ECHO is off, so the test cannot read the code");

  const verified = await instance.inject({
    method: "POST",
    url: "/auth/otp/verify",
    payload: { challengeId, code: devCode },
  });
  if (verified.statusCode !== 200) {
    throw new Error(`Could not sign in as ${mobile}: ${verified.statusCode} ${verified.body}`);
  }
  return cookieFrom(verified.headers["set-cookie"]);
}

function cookieFrom(header: string | string[] | undefined): string {
  const all = Array.isArray(header) ? header : [header ?? ""];
  const session = all.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!session) throw new Error("No session cookie was set");
  return session.split(";")[0]!;
}

/**
 * Skips the test when the fixture it needs is not in the seed.
 *
 * The alternative — returning early — reports a pass, which is the worst
 * possible outcome: a green suite that checked nothing. This makes the gap
 * visible in the run output instead.
 */
export function needs<T>(context: { skip: (note?: string) => void }, value: T | null | undefined, why: string): asserts value is T {
  if (value === null || value === undefined) context.skip(`no fixture: ${why}`);
}

/** One row, from a query written to read as the thing it is looking for. */
export async function one<T extends Record<string, unknown>>(query: string): Promise<T> {
  const rows = (await db.execute(sql.raw(query))) as unknown as T[];
  const row = rows[0];
  if (!row) throw new Error(`No row for: ${query}`);
  return row;
}

/** The same, for a query that may legitimately find nothing. */
export async function maybe<T extends Record<string, unknown>>(query: string): Promise<T | null> {
  const rows = (await db.execute(sql.raw(query))) as unknown as T[];
  return rows[0] ?? null;
}
