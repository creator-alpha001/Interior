/**
 * Runs one scheduled job immediately.
 *
 *   npm run job --workspace=api -- invoice.mark-overdue
 *
 * A nightly sweep should be testable without waiting until two in the morning
 * or editing a cron expression to fire in a minute and then forgetting to put
 * it back.
 */
import { closeDatabase } from "../db/client";
import { jobNames, runJobNow } from "./index";

async function main() {
  const name = process.argv[2];

  if (!name) {
    console.log("Usage: npm run job --workspace=api -- <name>\n");
    for (const job of jobNames) {
      console.log(`  ${job.name.padEnd(24)} ${job.cron.padEnd(14)} ${job.description}`);
    }
    return;
  }

  const started = Date.now();
  const result = await runJobNow(name);
  console.log(`${name}: handled ${result.handled}${result.detail ? ` (${result.detail})` : ""} in ${Date.now() - started}ms`);
}

main()
  .then(async () => {
    await closeDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
