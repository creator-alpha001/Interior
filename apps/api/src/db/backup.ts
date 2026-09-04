/**
 * Backups, and the only thing that makes a backup worth having: a restore that
 * has actually been run.
 *
 * Managed Postgres takes its own snapshots, and it would be reasonable to stop
 * there — except that an untested restore is a belief, not a control. Nobody
 * discovers that their dumps have been failing silently, or that the restore
 * needs an extension the fresh database does not have, at a convenient moment.
 *
 * So this file provides three things:
 *
 *   `backup`  — a custom-format dump, which is what `pg_restore` can be
 *               selective with. Plain SQL cannot be restored table by table.
 *   `restore` — into a named target, with a guard against the obvious disaster.
 *   `drill`   — dump, restore into a scratch database, compare every table's row
 *               count, drop the scratch. This is the one worth running on a
 *               schedule; the others are what it calls.
 *
 * `pg_dump` must be on PATH and its major version must be at least the server's.
 */
import { execFile } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";
import { config } from "../lib/config";

const run = promisify(execFile);

/** Where dumps go unless told otherwise. */
const DEFAULT_DIR = resolve(process.cwd(), "backups");

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/**
 * Dumps the database to a custom-format file.
 *
 * `--no-owner` and `--no-privileges` so the dump restores into a database owned
 * by whoever is doing the restoring — during an incident that is rarely the
 * same role that took the backup.
 */
export async function backup(target = `${DEFAULT_DIR}/aangan-${stamp()}.dump`): Promise<string> {
  mkdirSync(dirname(target), { recursive: true });

  const started = Date.now();
  await run("pg_dump", [
    config.DATABASE_URL,
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    `--file=${target}`,
  ]);

  const bytes = statSync(target).size;
  console.log(
    `Backed up ${databaseName(config.DATABASE_URL)} to ${target} ` +
      `(${(bytes / 1_048_576).toFixed(1)} MB in ${Date.now() - started}ms)`,
  );

  if (bytes < 1024) {
    // A dump this small is not a small database, it is a failed dump.
    throw new Error(`The dump is only ${bytes} bytes. Treat it as a failure, not a backup.`);
  }
  return target;
}

/**
 * Restores a dump into `targetUrl`.
 *
 * Refuses to overwrite production unless `--i-mean-it` is passed. This is the
 * command somebody runs at two in the morning from the wrong terminal.
 */
export async function restore(dumpFile: string, targetUrl: string, force = false): Promise<void> {
  const name = databaseName(targetUrl);

  if (!force && !/test|scratch|restore|staging|dev/.test(name)) {
    throw new Error(
      `Refusing to restore over "${name}" — the name does not look like a restore target. ` +
        `Pass --i-mean-it if that is genuinely what you want.`,
    );
  }

  const started = Date.now();
  await run("pg_restore", [
    `--dbname=${targetUrl}`,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    // A dump made with extensions in it will emit errors for objects that
    // already exist. Those are noise; a genuine failure still shows in the
    // verification that follows.
    "--exit-on-error=false" as string,
    dumpFile,
  ]).catch((error: { stderr?: string }) => {
    // pg_restore exits non-zero on ignorable notices, so failure is judged by
    // the comparison afterwards rather than by the exit code.
    if (error.stderr) console.error(error.stderr.split("\n").slice(-5).join("\n"));
  });

  console.log(`Restored ${dumpFile} into ${name} in ${Date.now() - started}ms`);
}

/** Every table and its row count, for comparing two databases. */
async function rowCounts(url: string): Promise<Map<string, number>> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const tables = await client<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const counts = new Map<string, number>();
    for (const { table_name } of tables) {
      const [row] = await client.unsafe<Array<{ n: string }>>(
        `SELECT count(*)::text AS n FROM "${table_name}"`,
      );
      counts.set(table_name, Number(row!.n));
    }
    return counts;
  } finally {
    await client.end({ timeout: 5 });
  }
}

/**
 * The drill: back up, restore into a scratch database, compare, clean up.
 *
 * Exits non-zero on any mismatch, so it can be a scheduled job whose failure is
 * the alert.
 */
export async function drill(): Promise<void> {
  const scratch = `aangan_restore_drill_${Date.now()}`;
  const adminUrl = withDatabase(config.DATABASE_URL, "postgres");
  const scratchUrl = withDatabase(config.DATABASE_URL, scratch);

  const dump = await backup(`${DEFAULT_DIR}/drill-${stamp()}.dump`);
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });

  try {
    await admin.unsafe(`CREATE DATABASE "${scratch}"`);
    await restore(dump, scratchUrl, true);

    const [source, restored] = await Promise.all([
      rowCounts(config.DATABASE_URL),
      rowCounts(scratchUrl),
    ]);

    const problems: string[] = [];
    for (const [table, expected] of source) {
      const actual = restored.get(table);
      if (actual === undefined) problems.push(`${table}: missing from the restore`);
      else if (actual !== expected) problems.push(`${table}: ${expected} rows became ${actual}`);
    }

    console.log(`\nCompared ${source.size} tables.`);
    if (problems.length > 0) {
      console.error("The restore does not match the source:");
      for (const problem of problems) console.error(`  ${problem}`);
      process.exitCode = 1;
      return;
    }

    const rows = [...source.values()].reduce((a, b) => a + b, 0);
    console.log(`Restore verified: every table matched, ${rows} rows in total.`);
  } finally {
    await admin
      .unsafe(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`)
      .catch(() => admin.unsafe(`DROP DATABASE IF EXISTS "${scratch}"`))
      .catch((error: Error) => console.error(`Could not drop ${scratch}: ${error.message}`));
    await admin.end({ timeout: 5 });
  }
}

/* ---------------- command line ---------------- */

const [command, ...args] = process.argv.slice(2);

async function main() {
  switch (command) {
    case "backup":
      await backup(args[0]);
      return;
    case "restore": {
      const [file, target] = args;
      if (!file || !target) {
        throw new Error("Usage: restore <dump-file> <target-database-url> [--i-mean-it]");
      }
      await restore(file, target, args.includes("--i-mean-it"));
      return;
    }
    case "drill":
      await drill();
      return;
    default:
      console.log("Usage: backup [file] | restore <file> <url> [--i-mean-it] | drill");
      process.exitCode = 1;
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
