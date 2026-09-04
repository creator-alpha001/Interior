/**
 * Builds the test database once, before any test file runs.
 *
 * Dropped and recreated every time rather than migrated in place. A schema that
 * only ever accumulates migrations hides the case where a migration works
 * forward from *your* database but not from an empty one — which is the case
 * that matters on a deploy.
 */
import { execFileSync } from "node:child_process";
import postgres from "postgres";

/**
 * The owner connection. Creating a database, running migrations and seeding are
 * all owner work — the API's own role deliberately cannot do them, which is the
 * point of having two.
 */
const url =
  process.env.TEST_OWNER_DATABASE_URL ?? "postgresql://aangan@localhost:55432/aangan_test";

function adminUrl(): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

function databaseName(): string {
  return new URL(url).pathname.replace(/^\//, "");
}

export default async function setup(): Promise<void> {
  const name = databaseName();

  // Guard rail. `aangan_dev` holds the seeded walkthrough and is the database a
  // developer is looking at; nothing here should ever be pointed at it.
  if (!name.includes("test")) {
    throw new Error(`Refusing to run tests against "${name}" — the name must contain "test"`);
  }

  const admin = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    // Anything still connected would block the drop.
    await admin.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = '${name}' AND pid <> pg_backend_pid()`,
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  // Migrations and seed run as their own processes so they use the same entry
  // points a deploy does. A test harness with a private path to the schema
  // proves the harness works, not the deploy.
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: url, RUN_JOBS: "false" };
  const run = (script: string) =>
    execFileSync("npx", ["tsx", script], { env, stdio: "pipe", shell: true });

  run("src/db/migrate.ts");
  run("src/db/seed.ts");
}
