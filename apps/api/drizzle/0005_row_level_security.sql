-- Row-level security, as defence in depth.
--
-- The scoped repository is still the primary control: every customer- and
-- vendor-facing query applies its own WHERE, and the tests assert that reading
-- somebody else's record is refused. This is the layer underneath, for the day
-- a query is written without that clause — which is exactly what happened
-- before the backend existed, twice, in getLead and getAgreement.
--
-- How it works
-- ------------
-- A customer or vendor request runs on a reserved connection carrying three
-- settings: app.user_id, app.client_id and app.professional_id. The policies
-- below read them.
--
-- **When the settings are absent, everything is visible.** That is deliberate,
-- and it is what makes this shippable rather than a rewrite:
--
--   * Ops legitimately read across every customer — that is the job. Policies
--     that constrained them would have to be granted straight back.
--   * The jobs, the migrations and the seed have no actor at all.
--   * Any query written before today keeps working unchanged.
--
-- So this narrows the personal surfaces and leaves the rest as it was. It is a
-- containment layer, not a perimeter: it turns "a forgotten WHERE leaks another
-- customer's requirement" into "a forgotten WHERE returns nothing".
--
-- Two things are needed for any of this to bite, and both are easy to miss:
--
--   * FORCE, not just ENABLE. ENABLE exempts the table's owner.
--   * A connecting role that is not a superuser. A superuser bypasses row-level
--     security completely — policies, FORCE and all — and on most managed
--     Postgres the default user is one. The role at the bottom of this file
--     exists for that reason.

-- Two performance notes, both measured rather than assumed:
--
--   * PARALLEL SAFE on every function. A function is parallel-unsafe by
--     default, and a policy containing one disables parallel query for every
--     scan of that table.
--
--   * Every actor test below is wrapped in `(SELECT ...)`. A bare
--     `current_setting()` in a policy is evaluated once per row — 110ms to
--     count 37,000 leads, on a value that cannot change during the query. As a
--     scalar subquery with no outer reference it becomes an InitPlan, run once.

-- Is anybody identified on this connection?
CREATE OR REPLACE FUNCTION app_actor_present() RETURNS boolean AS $$
  SELECT coalesce(current_setting('app.user_id', true), '') <> '';
$$ LANGUAGE sql STABLE PARALLEL SAFE;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_client_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.client_id', true), '')::uuid;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_professional_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.professional_id', true), '')::uuid;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Breaking the recursion
-- ------------------------------------------------------------------
-- A lead is visible to a vendor through its services, and a service is visible
-- to a customer through its lead. Written directly, each policy queries the
-- other's table and Postgres refuses the pair outright: "infinite recursion
-- detected in policy for relation leads".
--
-- These helpers are SECURITY DEFINER, so they run as the owner and are not
-- themselves subject to the policies — which is what breaks the cycle. They are
-- kept deliberately small and read-only, take one id, and answer one question,
-- because a SECURITY DEFINER function is the owner's authority lent out and the
-- narrower that loan is the better.

CREATE OR REPLACE FUNCTION app_owns_lead(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM leads l WHERE l.id = target AND l.client_id = app_client_id());
$$;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_assigned_to_lead(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM lead_domains ld
    JOIN lead_domain_assignments a ON a.lead_domain_id = ld.id
    WHERE ld.lead_id = target AND a.professional_id = app_professional_id()
  );
$$;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_owns_service(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM lead_domains ld
    JOIN leads l ON l.id = ld.lead_id
    WHERE ld.id = target AND l.client_id = app_client_id()
  );
$$;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_assigned_to_service(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM lead_domain_assignments a
    WHERE a.lead_domain_id = target AND a.professional_id = app_professional_id()
  );
$$;

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Leads
-- ------------------------------------------------------------------
-- A customer sees their own requirements. A vendor sees the ones they have been
-- assigned to — they are working them, but they reach the lead through the
-- service, never through the customer.

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS leads_visible ON leads;
CREATE POLICY leads_visible ON leads
  USING (
    (SELECT NOT app_actor_present())
    OR client_id = (SELECT app_client_id())
    OR app_assigned_to_lead(id)
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Services
-- ------------------------------------------------------------------

ALTER TABLE lead_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_domains FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS lead_domains_visible ON lead_domains;
CREATE POLICY lead_domains_visible ON lead_domains
  USING (
    (SELECT NOT app_actor_present())
    OR app_owns_lead(lead_id)
    OR app_assigned_to_service(id)
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Messages
-- ------------------------------------------------------------------
-- The firewall again, this time as a visibility rule rather than a write rule.
-- A customer sees the client channel on their own services and nothing else; a
-- vendor sees only their own side of the vendor channel — not another vendor's
-- negotiation on the same job, which is commercially sensitive between
-- competitors bidding for the same work.

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS messages_visible ON messages;
CREATE POLICY messages_visible ON messages
  USING (
    (SELECT NOT app_actor_present())
    OR (channel = 'client_platform' AND app_owns_service(lead_domain_id))
    OR (channel = 'platform_vendor' AND professional_id = (SELECT app_professional_id()))
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Quotes
-- ------------------------------------------------------------------
-- A vendor sees their own quotes. A customer sees quotes on their own services —
-- comparing them is the entire point of the screen.

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS quotes_visible ON quotes;
CREATE POLICY quotes_visible ON quotes
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
    OR app_owns_service(lead_domain_id)
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Projects, agreements and invoices
-- ------------------------------------------------------------------

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS projects_visible ON projects;
CREATE POLICY projects_visible ON projects
  USING (
    (SELECT NOT app_actor_present())
    OR client_id = (SELECT app_client_id())
    OR professional_id = (SELECT app_professional_id())
  );

--> statement-breakpoint

ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS agreements_visible ON agreements;
CREATE POLICY agreements_visible ON agreements
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
    OR app_owns_lead(lead_id)
  );

--> statement-breakpoint

-- A vendor's commission is between them and the platform. No customer sees one.
ALTER TABLE commission_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_invoices FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS invoices_visible ON commission_invoices;
CREATE POLICY invoices_visible ON commission_invoices
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Notifications
-- ------------------------------------------------------------------

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS notifications_visible ON notifications;
CREATE POLICY notifications_visible ON notifications
  USING (
    (SELECT NOT app_actor_present())
    OR user_id = (SELECT nullif(current_setting('app.user_id', true), '')::uuid)
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- The application role
-- ------------------------------------------------------------------
-- None of the above means anything unless the API connects as a role that is
-- subject to it. A superuser — and on most managed Postgres the default user is
-- one — bypasses row-level security entirely, policies and FORCE included, so
-- everything in this file would be decorative. That is not a hypothetical: it
-- was the state this migration was first written in, and the tests caught it.
--
-- So: a role that owns nothing, can do everything the API needs, and cannot
-- bypass a policy. Migrations, the seed and the restore drill keep running as
-- the owner; only the running service uses this one.
--
-- It is created without LOGIN. Granting that, and setting a password, is a
-- deployment step rather than a migration, because a password in version
-- control is not a password:
--
--   ALTER ROLE aangan_app WITH LOGIN PASSWORD '...';
--
-- then point the service's DATABASE_URL at it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aangan_app') THEN
    CREATE ROLE aangan_app NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
  END IF;
END
$$;

--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO aangan_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aangan_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aangan_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO aangan_app;

--> statement-breakpoint

-- Tables added by later migrations, without having to remember this file.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aangan_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO aangan_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO aangan_app;

--> statement-breakpoint

-- pg-boss builds and maintains its own schema on first run. Dynamic SQL because
-- GRANT will not take a function in place of the database name.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO aangan_app', current_database());
END
$$;

--> statement-breakpoint

-- pg-boss's schema, if it is already there.
--
-- On a fresh database the app role creates it itself and owns it. On a database
-- that has already run the jobs — every existing environment — the owner
-- created it, and the app role has no rights on it at all, so the service will
-- not start: "permission denied for schema pgboss". Found the hard way.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
    GRANT USAGE, CREATE ON SCHEMA pgboss TO aangan_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO aangan_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO aangan_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aangan_app;
  END IF;
END
$$;

--> statement-breakpoint

-- ------------------------------------------------------------------
-- The ops role
-- ------------------------------------------------------------------
-- Staff read across every customer — the lead queue, the relay console and the
-- dashboards are all "show me everybody's work", and that is the job. Under the
-- policies above they still got everything, because no actor is set on their
-- connection, but they paid for the policy to be evaluated on every row: about
-- 150ms on a dashboard over fifty thousand leads, for a filter that let all of
-- them through.
--
-- BYPASSRLS is exactly and only the privilege that removes that. It is not
-- superuser: this role cannot create databases, cannot alter the schema, and is
-- still bound by every grant. Staff access is controlled by the permission
-- checks and recorded in the audit trail; row-level security was never what
-- stood between an admin and a customer's record.
--
-- Granting LOGIN and a password is a deployment step, as with aangan_app.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aangan_ops') THEN
    CREATE ROLE aangan_ops NOSUPERUSER BYPASSRLS NOCREATEROLE NOCREATEDB;
  END IF;
END
$$;

--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO aangan_ops;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aangan_ops;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aangan_ops;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO aangan_ops;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aangan_ops;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO aangan_ops;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO aangan_ops;
