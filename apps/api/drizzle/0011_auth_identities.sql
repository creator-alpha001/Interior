--
-- Sign-in methods that are not a mobile number.
--
-- The table exists so a returning customer can press "Continue with Google"
-- instead of waiting for an SMS. It does not replace `users.mobile`, which is
-- still NOT NULL and still how ops ring somebody about their lead — a Google
-- account carries a verified email and a name, never a phone number.
--
CREATE TYPE auth_provider AS ENUM ('google', 'apple');
--> statement-breakpoint

CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider auth_provider NOT NULL,
  subject text NOT NULL,
  email text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
--> statement-breakpoint

-- One provider subject belongs to exactly one account. Without this a second
-- row would quietly hand a second person the same sign-in.
CREATE UNIQUE INDEX uq_auth_identities_provider_subject
  ON auth_identities (provider, subject);
--> statement-breakpoint

CREATE INDEX ix_auth_identities_user ON auth_identities (user_id);
--> statement-breakpoint

-- Row-level security, matching `sessions` rather than `otp_challenges`.
--
-- A person may list and unlink their own sign-in methods, so the rule is the
-- same shape as sessions: everything is visible with no actor set, which is how
-- signing in works at all, and scoped to the owner once a scope is open.
ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE auth_identities FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS auth_identities_own ON auth_identities;
--> statement-breakpoint
CREATE POLICY auth_identities_own ON auth_identities
  USING ((SELECT NOT app_actor_present()) OR user_id = (SELECT app_user_id()));
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_identities TO aangan_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_identities TO aangan_ops;
