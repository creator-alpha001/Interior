/**
 * Applies pending migrations, then exits.
 *
 * Run as a release step before the new API instances start, so a deploy never
 * has code and schema out of step for longer than the migration takes.
 */
import "./as-owner";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { closeDatabase, db } from "./client";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const folder = resolve(here, "../../drizzle");
  console.log(`Applying migrations from ${folder}`);

  const started = Date.now();
  await migrate(db, { migrationsFolder: folder });
  console.log(`Migrations applied in ${Date.now() - started}ms`);
}

main()
  .then(async () => {
    await closeDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Migration failed:", error);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
