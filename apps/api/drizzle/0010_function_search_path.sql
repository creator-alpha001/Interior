-- `uuid_generate_v7()` could not find `gen_random_bytes` on Supabase.
--
-- Migration 0000 creates the function on top of pgcrypto and leaves its
-- search_path unset, so it resolves `gen_random_bytes` through whatever path
-- the *caller* happens to have. On a local Postgres every role has `public`
-- and pgcrypto is installed there, so it works and nothing suggests a problem.
--
-- Supabase installs extensions into an `extensions` schema instead, and the
-- application role's path is `"$user", public`. Seeding still worked, because
-- that runs as the owner, whose path includes `extensions`. The first insert
-- from the API did not:
--
--     function gen_random_bytes(integer) does not exist
--
-- and since almost every table defaults its primary key to this function, that
-- is every write in the product — including the only path to signing in.
--
-- Pinning the function's own search_path fixes it for every caller and every
-- role, present and future, rather than patching one role's path and leaving
-- the next one to rediscover this. It is also what a SECURITY-conscious
-- definition should have had from the start: a function that resolves
-- unqualified names through the caller's path is how search_path injection
-- works.
--
-- `pg_temp` last, and explicitly, so a temporary object cannot shadow either
-- schema during the call.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v7') THEN
    -- `extensions` may not exist off Supabase; naming a missing schema in a
    -- search_path is not an error, it is simply skipped when resolving.
    EXECUTE 'ALTER FUNCTION public.uuid_generate_v7() SET search_path = public, extensions, pg_temp';
  END IF;
END
$$;
