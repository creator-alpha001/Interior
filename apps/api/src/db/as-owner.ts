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
 */
if (process.env.OWNER_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.OWNER_DATABASE_URL;
}
