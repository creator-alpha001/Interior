/**
 * Writes and verifies `openapi.json` at the repository root.
 *
 * The document is committed rather than generated on demand, and CI fails when
 * regenerating changes it. `MOBILE.md` 4.3 is blunt about why: a generator
 * nobody runs is worse than no generator, because stale output still looks
 * authoritative. Committing it makes a contract change show up as a reviewable
 * diff in the same commit that caused it.
 *
 * `--check` is the CI half. It needs no database and no running server, so it
 * can gate a pull request cheaply.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildOpenApiDocument } from "./generate";

/** From `packages/contract/src/openapi/` up to the repository root. */
export const OPENAPI_PATH = resolve(import.meta.dirname, "../../../../openapi.json");

export function serialise(): string {
  return `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
}

function main() {
  const next = serialise();
  const checking = process.argv.includes("--check");

  if (checking) {
    let current: string;
    try {
      current = readFileSync(OPENAPI_PATH, "utf8");
    } catch {
      console.error("openapi.json is missing. Run `npm run openapi`.");
      process.exit(1);
    }

    if (current !== next) {
      console.error(
        "openapi.json is out of date with the route manifest.\n" +
          "Run `npm run openapi` and commit the result.",
      );
      process.exit(1);
    }

    console.log("openapi.json is up to date.");
    return;
  }

  writeFileSync(OPENAPI_PATH, next, "utf8");

  const document = buildOpenApiDocument();
  const paths = Object.keys(document["paths"] as object).length;
  const schemas = Object.keys((document["components"] as { schemas: object }).schemas).length;
  console.log(`openapi.json written: ${paths} paths, ${schemas} schemas -> ${OPENAPI_PATH}`);
}

/**
 * Only when run as a script, never on import.
 *
 * Without this guard, the staleness test in `tests/contract.test.ts` imported
 * `serialise` from here, `main()` ran as a side effect of that import, and the
 * file was rewritten before the assertion compared it — so the test passed
 * against a document it had just regenerated. It was checking nothing. Found by
 * tampering with the committed file and watching the test stay green.
 */
if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
