/**
 * Switches this process to the owner's connection.
 *
 * Migrations, the seed, backups and the restore drill create tables and read
 * across every customer. The service's role deliberately cannot do either — it
 * is not a superuser, so that row-level security applies to it — which means
 * these scripts need the other one.
 *
 * **Import this before anything else.** ES modules evaluate in import order, so
 * as long as this line comes first the environment is switched before
 * `lib/config` reads it. Move it below another import and the script quietly
 * connects as the app role and fails on the first CREATE.
 *
 * Two things below look fussier than they are, and each fixes a failure that
 * actually happened.
 *
 * **`.env` has to be loaded here.** Being first means being first: `lib/config`
 * had not run yet, so nothing had read `.env`, so `OWNER_DATABASE_URL` was
 * undefined and the swap silently did nothing. In a deployment the variable is
 * a real environment variable and this worked; locally, where it only lives in
 * `.env`, every migration and seed ran as the app role and failed on the first
 * CREATE — exactly the failure the paragraph above warns about.
 *
 * **And a caller who names a database outranks `.env`.** The test harness
 * spawns `migrate.ts` with `DATABASE_URL` pointing at `aangan_test` and nothing
 * else set. Loading `.env` there filled in `OWNER_DATABASE_URL` from the
 * *development* config, the swap below replaced the URL it had been given, and
 * the test suite migrated and seeded `aangan_dev` while leaving `aangan_test`
 * empty — every test then failing with `relation "leads" does not exist`,
 * pointing at the wrong problem entirely. Worse than a broken suite: a test run
 * that writes to the database somebody is looking at.
 *
 * So the precedence is explicit rather than incidental, and the check has to
 * happen *before* `dotenv` runs — which is why `config()` is called rather than
 * `import "dotenv/config"`, whose side effect would be hoisted above these
 * lines.
 */
import { config } from "dotenv";

/** What the caller set, as distinct from what `.env` is about to offer. */
const explicit = {
  database: process.env.DATABASE_URL,
  owner: process.env.OWNER_DATABASE_URL,
};

// Never overwrites a variable that is already set, so this cannot change what
// a deployment sees.
config();

const owner =
  // An owner URL from the caller is unambiguous: use it.
  explicit.owner ??
  // Otherwise `.env` may supply one — but only when the caller did not pin a
  // database themselves. If they did, they have already chosen.
  (explicit.database ? undefined : process.env.OWNER_DATABASE_URL);

if (owner) {
  process.env.DATABASE_URL = owner;
}
