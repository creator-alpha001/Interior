/**
 * Integration tests, not unit tests.
 *
 * Everything here runs against a real PostgreSQL database, because what these
 * tests assert is that *the database* refuses things — a mock would only prove
 * that the test author remembered the rule, which is exactly what the
 * application code already does and exactly what keeps going wrong.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Set before any module loads, because `lib/config` reads the environment
     * at import time. A test that pointed at the development database would
     * delete somebody's work on its first truncate.
     */
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://aangan@localhost:55432/aangan_test",
      SESSION_SECRET: "test-session-secret-not-used-anywhere-real",
      OTP_DEV_ECHO: "true",
      RUN_JOBS: "false",
      LOG_LEVEL: "fatal",
    },
    // One database, shared. Parallel files would race on the same rows.
    fileParallelism: false,
    globalSetup: ["./tests/helpers/global-setup.ts"],
    setupFiles: ["./tests/helpers/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Migrating and seeding a fresh database is not a two-second job.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
