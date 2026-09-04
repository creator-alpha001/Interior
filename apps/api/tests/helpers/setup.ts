/**
 * Per-file setup. Closes the pool afterwards so the run does not hang on an
 * open connection once the assertions have passed.
 */
import { afterAll } from "vitest";
import { closeDatabase } from "../../src/db/client";

afterAll(async () => {
  await closeDatabase();
});
