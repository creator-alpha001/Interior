-- Row-level security for everything else personal.
--
-- Migration 0005 covered the eight tables where a leak would be worst. This
-- covers the rest of the personal surface, and closes three gaps that were
-- worse than the ones already closed:
--
--   * `media_assets` holds photographs of the inside of people's homes.
--   * `lead_sales_activities` holds what an agent wrote down about a customer
--     after a phone call. It is an internal record, and neither the customer
--     nor the vendor should be able to read a word of it.
--   * `sessions`, `staff_credentials` and `otp_challenges` hold the material
--     that authentication is made of. Nothing running inside a customer's
--     request has any business reading them, their own session aside.
--
-- The shape is the same as 0005 throughout: absent settings mean no restriction,
-- so ops, the jobs, the migrations and the seed are unaffected; every actor test
-- is wrapped in `(SELECT ...)` so it is evaluated once rather than per row; and
-- anything that has to consult a table which itself has a policy goes through a
-- SECURITY DEFINER helper, or the two policies would recurse.

-- ------------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid;
$$;

--> statement-breakpoint

/* The customer is a party to this project, or the vendor is doing it. */
CREATE OR REPLACE FUNCTION app_party_to_project(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = target
      AND (p.client_id = app_client_id() OR p.professional_id = app_professional_id())
  );
$$;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_party_to_agreement(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM agreements a
    JOIN leads l ON l.id = a.lead_id
    WHERE a.id = target
      AND (l.client_id = app_client_id() OR a.professional_id = app_professional_id())
  );
$$;

--> statement-breakpoint

/*
 * A vendor is working for this customer on something.
 *
 * What lets a vendor read the customer's row at all — they need a name and,
 * once a visit is confirmed, an address. What they are shown from that row is
 * still decided by the masking layer; this only decides which rows exist.
 */
CREATE OR REPLACE FUNCTION app_vendor_serves_client(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM leads l
    JOIN lead_domains ld ON ld.lead_id = l.id
    JOIN lead_domain_assignments a ON a.lead_domain_id = ld.id
    WHERE l.client_id = target AND a.professional_id = app_professional_id()
  );
$$;

--> statement-breakpoint

-- ------------------------------------------------------------------
-- The customer record
-- ------------------------------------------------------------------

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS clients_visible ON clients;
CREATE POLICY clients_visible ON clients
  USING (
    (SELECT NOT app_actor_present())
    OR id = (SELECT app_client_id())
    OR app_vendor_serves_client(id)
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- The call log
-- ------------------------------------------------------------------
-- Internal. An agent's notes about a customer are for the platform, and the
-- customer being described is the last person who should be reading them.

ALTER TABLE lead_sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sales_activities FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS activities_internal ON lead_sales_activities;
CREATE POLICY activities_internal ON lead_sales_activities
  USING ((SELECT NOT app_actor_present()));

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Uploads
-- ------------------------------------------------------------------
-- Photographs of the inside of somebody's home, and vendors' documents.
--
-- An asset is reachable by whoever uploaded it, and otherwise by what it hangs
-- off: catalogue and blog imagery is public, portfolio images are a vendor's
-- shop window, and stage proof belongs to the two parties on that project.

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS media_visible ON media_assets;
CREATE POLICY media_visible ON media_assets
  USING (
    (SELECT NOT app_actor_present())
    OR uploaded_by_user_id = (SELECT app_user_id())
    OR owner_type IN ('product', 'service_package', 'blog_post', 'portfolio_item')
    OR (
      owner_type = 'project_milestone'
      AND app_party_to_project((
        SELECT m.project_id FROM project_milestones m WHERE m.id = media_assets.owner_id
      ))
    )
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Site visits
-- ------------------------------------------------------------------

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS meetings_visible ON meetings;
CREATE POLICY meetings_visible ON meetings
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
    OR app_owns_service(lead_domain_id)
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- What the customer picked, and who was offered the job
-- ------------------------------------------------------------------

ALTER TABLE lead_domain_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_domain_items FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS lead_domain_items_visible ON lead_domain_items;
CREATE POLICY lead_domain_items_visible ON lead_domain_items
  USING (
    (SELECT NOT app_actor_present())
    OR app_owns_service(lead_domain_id)
    OR app_assigned_to_service(lead_domain_id)
  );

--> statement-breakpoint

-- A vendor sees that they were offered the job, not who else was.
ALTER TABLE lead_domain_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_domain_assignments FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS assignments_visible ON lead_domain_assignments;
CREATE POLICY assignments_visible ON lead_domain_assignments
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
    OR app_owns_service(lead_domain_id)
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Execution
-- ------------------------------------------------------------------

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS milestones_visible ON project_milestones;
CREATE POLICY milestones_visible ON project_milestones
  USING ((SELECT NOT app_actor_present()) OR app_party_to_project(project_id));

--> statement-breakpoint

ALTER TABLE agreement_lead_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_lead_domains FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS agreement_services_visible ON agreement_lead_domains;
CREATE POLICY agreement_services_visible ON agreement_lead_domains
  USING ((SELECT NOT app_actor_present()) OR app_party_to_agreement(agreement_id));

--> statement-breakpoint

-- A vendor's signed terms are between them and the platform.
ALTER TABLE partner_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_agreements FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS partner_agreements_visible ON partner_agreements;
CREATE POLICY partner_agreements_visible ON partner_agreements
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
  );

--> statement-breakpoint

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS refunds_visible ON refunds;
CREATE POLICY refunds_visible ON refunds
  USING ((SELECT NOT app_actor_present()) OR client_id = (SELECT app_client_id()));

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Support
-- ------------------------------------------------------------------

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS tickets_visible ON support_tickets;
CREATE POLICY tickets_visible ON support_tickets
  USING (
    (SELECT NOT app_actor_present())
    OR raised_by_user_id = (SELECT app_user_id())
  );

--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_raised_ticket(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_tickets t
    WHERE t.id = target AND t.raised_by_user_id = app_user_id()
  );
$$;

--> statement-breakpoint

ALTER TABLE ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_replies FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS ticket_replies_visible ON ticket_replies;
CREATE POLICY ticket_replies_visible ON ticket_replies
  USING ((SELECT NOT app_actor_present()) OR app_raised_ticket(ticket_id));

--> statement-breakpoint

-- ------------------------------------------------------------------
-- The customer's own things
-- ------------------------------------------------------------------

ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS saved_items_visible ON saved_items;
CREATE POLICY saved_items_visible ON saved_items
  USING ((SELECT NOT app_actor_present()) OR client_id = (SELECT app_client_id()));

--> statement-breakpoint

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS referrals_visible ON referrals;
CREATE POLICY referrals_visible ON referrals
  USING (
    (SELECT NOT app_actor_present())
    OR referrer_user_id = (SELECT app_user_id())
    OR referred_user_id = (SELECT app_user_id())
  );

--> statement-breakpoint

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS device_tokens_visible ON device_tokens;
CREATE POLICY device_tokens_visible ON device_tokens
  USING ((SELECT NOT app_actor_present()) OR user_id = (SELECT app_user_id()));

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Reviews
-- ------------------------------------------------------------------
-- Deliberately readable by everyone: a review is published on the vendor's
-- profile, and hiding it from the people choosing a vendor would defeat it. The
-- policy exists for the write side — WITH CHECK, so nobody can file a review in
-- somebody else's name.

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS reviews_readable ON reviews;
CREATE POLICY reviews_readable ON reviews FOR SELECT USING (true);

--> statement-breakpoint

DROP POLICY IF EXISTS reviews_written_by_their_author ON reviews;
CREATE POLICY reviews_written_by_their_author ON reviews FOR INSERT
  WITH CHECK (
    (SELECT NOT app_actor_present())
    OR client_id = (SELECT app_client_id())
  );

--> statement-breakpoint

DROP POLICY IF EXISTS reviews_edited_by_their_author ON reviews;
CREATE POLICY reviews_edited_by_their_author ON reviews FOR UPDATE
  USING (
    (SELECT NOT app_actor_present())
    OR client_id = (SELECT app_client_id())
  );

--> statement-breakpoint

-- ------------------------------------------------------------------
-- Authentication material and internal records
-- ------------------------------------------------------------------
-- Nothing running inside a customer's or vendor's request should be able to
-- read these. Sessions are the exception, and only their own: the route guards
-- resolve the session again inside the request, so a policy of "none at all"
-- would refuse every personal endpoint.
--
-- Signing in happens before any scope is opened, so none of this affects it.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS sessions_own ON sessions;
CREATE POLICY sessions_own ON sessions
  USING ((SELECT NOT app_actor_present()) OR user_id = (SELECT app_user_id()));

--> statement-breakpoint

ALTER TABLE staff_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_credentials FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS staff_credentials_internal ON staff_credentials;
CREATE POLICY staff_credentials_internal ON staff_credentials
  USING ((SELECT NOT app_actor_present()));

--> statement-breakpoint

ALTER TABLE otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_challenges FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS otp_challenges_internal ON otp_challenges;
CREATE POLICY otp_challenges_internal ON otp_challenges
  USING ((SELECT NOT app_actor_present()));

--> statement-breakpoint

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS audit_logs_internal ON audit_logs;
CREATE POLICY audit_logs_internal ON audit_logs
  USING ((SELECT NOT app_actor_present()));

--> statement-breakpoint

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS admin_users_internal ON admin_users;
CREATE POLICY admin_users_internal ON admin_users
  USING ((SELECT NOT app_actor_present()));

--> statement-breakpoint

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS admin_roles_internal ON admin_roles;
CREATE POLICY admin_roles_internal ON admin_roles
  USING ((SELECT NOT app_actor_present()));

--> statement-breakpoint

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS rate_limits_internal ON rate_limits;
CREATE POLICY rate_limits_internal ON rate_limits
  USING ((SELECT NOT app_actor_present()));

--> statement-breakpoint

-- ------------------------------------------------------------------
-- The user record
-- ------------------------------------------------------------------
-- Where the phone numbers and email addresses actually live, so the table this
-- whole exercise is ultimately about.
--
-- It is also the table most likely to break something by being restricted:
-- names are joined in from here all over the place, and a policy that is one
-- clause too narrow turns a vendor's lead list into a list of blanks rather
-- than into an error. Hence the four branches, and hence the tests that assert
-- each screen still shows real rows.
--
-- What a vendor may *see* of a customer's row is still the masking layer's
-- decision — `MaskedClientSummary` has no field for a number, and no vendor
-- query selects one. This decides which rows exist at all, which is the part
-- that survives somebody writing a new query without reading that file.

/*
 * Somebody you invited, or who invited you.
 *
 * The referral screen names the people you brought in, so their rows have to be
 * reachable. Missing this branch made that screen return nothing at all — no
 * error, just an empty list, which is exactly how an over-strict policy fails.
 */
CREATE OR REPLACE FUNCTION app_referral_counterpart(target uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM referrals r
    WHERE (r.referred_user_id = target AND r.referrer_user_id = app_user_id())
       OR (r.referrer_user_id = target AND r.referred_user_id = app_user_id())
  );
$$;

--> statement-breakpoint

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS users_visible ON users;
CREATE POLICY users_visible ON users
  USING (
    (SELECT NOT app_actor_present())
    -- Yourself.
    OR id = (SELECT app_user_id())
    -- Vendors are listed publicly; their names are the directory.
    OR EXISTS (SELECT 1 FROM professionals p WHERE p.user_id = users.id)
    -- A customer whose job this vendor is working on.
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.user_id = users.id AND app_vendor_serves_client(c.id)
    )
    -- Somebody you referred, or who referred you.
    OR app_referral_counterpart(id)
  );
