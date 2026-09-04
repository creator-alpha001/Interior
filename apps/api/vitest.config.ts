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
      /**
       * Connects as the application role, not the owner.
       *
       * This matters more than it looks: a superuser bypasses row-level
       * security entirely, so a suite run as the owner would pass every policy
       * test while proving nothing. The role is created by migration 0005;
       * `global-setup` migrates and seeds as the owner, the way a deploy does.
       */
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://aangan_app@localhost:55432/aangan_test",
      OWNER_DATABASE_URL:
        process.env.TEST_OWNER_DATABASE_URL ??
        "postgresql://aangan@localhost:55432/aangan_test",
      /**
       * The staff pool, which bypasses row-level security. Included so the
       * suite runs the same three-role arrangement production does — an ops
       * test passing on the application role would prove the wrong thing.
       */
      OPS_DATABASE_URL:
        process.env.TEST_OPS_DATABASE_URL ??
        "postgresql://aangan_ops@localhost:55432/aangan_test",
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
