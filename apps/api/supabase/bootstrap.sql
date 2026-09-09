-- Supabase bootstrap: run ONCE, as the project owner, AFTER the migrations.
--
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/supabase/bootstrap.sql
--
-- or paste it into the SQL editor, which already runs as `postgres`.
--
-- Order matters. `aangan_app` and `aangan_ops` are created by migrations 0005
-- and 0007 without a login, so those have to have run first — this file only
-- finishes them off. Running it against an unmigrated database fails on the
-- first ALTER ROLE, which is the correct thing for it to do.
--
-- What is left to do here is everything a migration cannot reasonably contain:
-- a password, and one grant that depends on who owns the database.

\set ON_ERROR_STOP on

-- ------------------------------------------------------------------
-- 1. Passwords
-- ------------------------------------------------------------------
--
-- Replace both. Generate them with:
--
--   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
--
-- These are the passwords that go into DATABASE_URL and OPS_DATABASE_URL. They
-- are NOT the project's `postgres` password, and neither role should ever be
-- given that one: `aangan_app` exists precisely because it cannot bypass
-- row-level security, and reusing `postgres` would undo migrations 0005 and
-- 0007 completely.

ALTER ROLE aangan_app WITH LOGIN PASSWORD 'REPLACE_WITH_APP_PASSWORD';
ALTER ROLE aangan_ops WITH LOGIN PASSWORD 'REPLACE_WITH_OPS_PASSWORD';

-- ------------------------------------------------------------------
-- 2. pg-boss's schema
-- ------------------------------------------------------------------
--
-- pg-boss creates and maintains schema `pgboss` itself, which needs CREATE on
-- the database. Migration 0005 grants that and, on Supabase, actually succeeds.
--
-- Pre-creating the schema here is the narrower privilege of the two, so it is
-- worth attempting either way — but it is genuinely optional, and both steps
-- can fail on a managed provider for reasons that are nobody's mistake:
--
--   * `CREATE SCHEMA ... AUTHORIZATION aangan_app` requires the *current* role
--     to be a member of `aangan_app` — Postgres will not let you hand something
--     to a role you could not become. On Supabase `postgres` is not a member,
--     so this fails with `must be able to SET ROLE "aangan_app"`.
--   * The GRANT that fixes it needs admin option on the role, which a managed
--     `postgres` may equally not have.
--
-- Neither is worth failing the bootstrap over, because the fallback is simply
-- what pg-boss does unaided: it has CREATE on the database, so it builds its own
-- schema on first run. Hence the nested blocks — this section reports what it
-- managed and never aborts the ALTER ROLEs above, which are the part that
-- matters.

DO $$
BEGIN
  BEGIN
    EXECUTE format('GRANT aangan_app TO %I', current_user);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No admin option on aangan_app; not pre-creating its schema.';
  END;

  BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION aangan_app';
    RAISE NOTICE 'pgboss schema ready, owned by aangan_app.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE
      'Could not pre-create the pgboss schema (%). This is fine: pg-boss creates '
      'it at boot, which works because aangan_app has CREATE on the database.',
      SQLERRM;
  END;
END
$$;

-- Ops never touches the queue, and the app role owns it, so no further grants.

-- ------------------------------------------------------------------
-- 3. Check the thing that silently breaks
-- ------------------------------------------------------------------
--
-- A connecting role that bypasses row-level security turns every policy in
-- 0005 and 0007 into decoration — no error, no log line, just a customer able
-- to read another customer's requirement the day a WHERE clause is forgotten.
-- Cheaper to assert it here than to discover it later.

DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(rolname, ', ') INTO bad
  FROM pg_roles
  WHERE rolname = 'aangan_app' AND (rolsuper OR rolbypassrls);

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'aangan_app is a superuser or has BYPASSRLS. Row-level security would not apply to it.';
  END IF;

  -- aangan_ops is *supposed* to have BYPASSRLS and nothing else. Staff read
  -- across every customer by design; see the note at the foot of 0005.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aangan_ops' AND rolbypassrls) THEN
    RAISE NOTICE 'aangan_ops does not have BYPASSRLS — ops queries will work, only slower.';
  END IF;
END
$$;
