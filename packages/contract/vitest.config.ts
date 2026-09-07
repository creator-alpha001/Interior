/**
 * Contract tests. No database, no server — the manifest and the document it
 * generates are pure values, so these can gate CI cheaply.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
