/**
 * Schema tests, which need no database.
 *
 * The API's suite runs against real PostgreSQL because what it asserts is that
 * the *database* refuses things. Nothing here does: these tests parse the seed
 * fixtures through the response schemas, so they are pure and fast, and they
 * run in CI without a service container.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
