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
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";
import { config } from "../lib/config";

const run = promisify(execFile);

/**
 * The owner's connection.
 *
 * Read from config rather than from the process environment, because this file
 * is also imported by the weekly drill job — and by then `lib/config` has long
 * since been evaluated, so the environment switch the command-line entry points
 * rely on would have no effect. The job would have run as the application role
 * and failed on CREATE DATABASE, which is the sort of thing that only shows up
 * the first Sunday after a deploy.
 */
function ownerUrl(): string {
  return config.OWNER_DATABASE_URL ?? config.DATABASE_URL;
}

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
    ownerUrl(),
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    `--file=${target}`,
  ]);

  const bytes = statSync(target).size;
  console.log(
    `Backed up ${databaseName(ownerUrl())} to ${target} ` +
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

/** What the drill found. */
export interface DrillResult {
  tables: number;
  rows: number;
  /** Empty when the restore matched. Each entry names a table and how it differed. */
  problems: string[];
}

/**
 * The drill: back up, restore into a scratch database, compare, clean up.
 *
 * Returns its findings rather than setting an exit code. It used to do the
 * latter, which was fine while it was only a command — but the weekly job
 * imports this module, and importing it ran the command-line block below and
 * set a failing exit code before the drill had done anything at all. A function
 * that reports through a process-global is a function that cannot be called
 * from anywhere else.
 */
export async function drill(): Promise<DrillResult> {
  const scratch = `aangan_restore_drill_${Date.now()}`;
  const adminUrl = withDatabase(ownerUrl(), "postgres");
  const scratchUrl = withDatabase(ownerUrl(), scratch);

  const dump = await backup(`${DEFAULT_DIR}/drill-${stamp()}.dump`);
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });

  try {
    await admin.unsafe(`CREATE DATABASE "${scratch}"`);
    await restore(dump, scratchUrl, true);

    const [source, restored] = await Promise.all([
      rowCounts(ownerUrl()),
      rowCounts(scratchUrl),
    ]);

    const problems: string[] = [];
    for (const [table, expected] of source) {
      const actual = restored.get(table);
      if (actual === undefined) problems.push(`${table}: missing from the restore`);
      else if (actual !== expected) problems.push(`${table}: ${expected} rows became ${actual}`);
    }

    const rows = [...source.values()].reduce((a, b) => a + b, 0);
    console.log(`\nCompared ${source.size} tables.`);

    if (problems.length > 0) {
      console.error("The restore does not match the source:");
      for (const problem of problems) console.error(`  ${problem}`);
    } else {
      console.log(`Restore verified: every table matched, ${rows} rows in total.`);
    }

    return { tables: source.size, rows, problems };
  } finally {
    await admin
      .unsafe(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`)
      .catch(() => admin.unsafe(`DROP DATABASE IF EXISTS "${scratch}"`))
      .catch((error: Error) => console.error(`Could not drop ${scratch}: ${error.message}`));
    await admin.end({ timeout: 5 });
  }
}

/* ---------------- command line ---------------- */

async function main() {
  const [command, ...args] = process.argv.slice(2);

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
    case "drill": {
      const result = await drill();
      if (result.problems.length > 0) process.exitCode = 1;
      return;
    }
    default:
      console.log("Usage: backup [file] | restore <file> <url> [--i-mean-it] | drill");
      process.exitCode = 1;
  }
}

/**
 * Only when run directly.
 *
 * Without this guard, importing anything from this file executed the command
 * line — which, with no arguments to read, printed the usage text and set a
 * failing exit code. The weekly drill job then reported a broken backup on its
 * own import.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
}
