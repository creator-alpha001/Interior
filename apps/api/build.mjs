/**
 * Builds the deployable server.
 *
 * `tsc` alone never produced something Node could run, and nothing noticed
 * because the app has only ever been started through `tsx` in development.
 * Three separate reasons it failed:
 *
 *   1. `rootDir: "../.."` put the entry at `dist/apps/api/src/server.js` while
 *      `npm start` looked for `dist/server.js`.
 *   2. Relative imports are written without extensions — `from "./app"` — which
 *      `moduleResolution: "bundler"` accepts and Node's ESM loader does not.
 *   3. `@repo/contract`, `@repo/types` and `@repo/mock` set `main` to
 *      `./src/index.ts` and have no build step, so the emitted JavaScript
 *      imported TypeScript that Node cannot execute.
 *
 * Bundling answers all three at once: the workspace packages are compiled in,
 * relative imports disappear, and the output lands exactly where `start`
 * expects it. It also makes deployment a great deal simpler — one file plus
 * `node_modules`, rather than a directory tree whose shape has to be preserved.
 *
 * Real dependencies stay external. They are installed on the server from the
 * lockfile, and two of them — `argon2` and `postgres` — have native or
 * conditional loading that a bundler should not go near.
 */
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const pkg = JSON.parse(await readFile(new URL("package.json", import.meta.url), "utf8"));

/**
 * Everything from npm is external; everything from this repository is bundled.
 *
 * The `@repo/*` packages are workspace symlinks pointing at raw TypeScript, so
 * they must be compiled in rather than resolved at runtime.
 */
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@repo/"));

await build({
  entryPoints: {
    server: "src/server.ts",

    /**
     * Kept at this depth on purpose. `migrate.ts` finds its SQL with
     * `resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle")`, so
     * from `dist/db/` that is `apps/api/drizzle` — the same folder it resolves
     * to in development. Flattening it to `dist/migrate.js` would silently
     * point the migrator at a directory that does not exist.
     */
    "db/migrate": "src/db/migrate.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
});
