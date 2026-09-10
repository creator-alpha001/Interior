--
-- Becoming a vendor.
--
-- Until now a professional record could only be created by ops, straight into
-- the database — `apps/api/src/modules/auth/repository.ts` says so in as many
-- words. That is a coherent position right up until somebody presses "Apply to
-- join" on the marketing page, at which point the platform has nowhere to put
-- them: the button pointed at /partner, /partner turns away anybody who is not
-- already a professional, and so a person who wanted to sell on the platform
-- was returned silently to the customer account area.
--
-- This is the missing record. It is deliberately not a `professionals` row with
-- a pending status:
--
--   * A professional row is joined to by leads, quotes, assignments and
--     invoices, and `actorFromRow` turns one into a session with the partner
--     portal behind it. Creating one for every hopeful applicant means every
--     one of those relationships has to start defending itself against a vendor
--     who was never approved.
--   * "Rejected" is not a state a vendor can be in. The row is simply never
--     created. Folding refusals into `verification_status` would mean either an
--     enum value the professionals table can never legitimately hold, or a
--     vendor record standing in for the absence of one.
--
-- Approval, in one transaction, creates the professional, the per-trade links
-- and the service areas, and moves the user's role across. Refusal writes a
-- reason and leaves nothing behind.
--

CREATE TYPE professional_application_status AS ENUM (
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected'
);

--> statement-breakpoint

CREATE TABLE professional_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id uuid NOT NULL REFERENCES users(id),
  company_name text NOT NULL,
  gst_number varchar(20),
  experience_years integer NOT NULL DEFAULT 0,
  bio text NOT NULL DEFAULT '',
  contact_name text NOT NULL,
  contact_mobile varchar(20),
  -- Read and written whole and never queried into, exactly like
  -- `sales_agents.assigned_city_ids`. Approval turns each requested domain into
  -- a `professional_domains` row, which is where per-trade decisions live once
  -- there is a vendor to attach them to.
  requested_domain_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_city_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_area_note text NOT NULL DEFAULT '',
  status professional_application_status NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_user_id uuid REFERENCES users(id),
  -- Written for the applicant to read, not for ops. A refusal with no reason
  -- gives somebody no way to fix anything and turns every decision into a
  -- support ticket, so the API requires one.
  reviewer_note text,
  -- Set on approval, pointing at the vendor record this became.
  professional_id uuid REFERENCES professionals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

--> statement-breakpoint

-- The reviewer's queue: oldest waiting first, which is the only order a queue
-- worked by humans can fairly have.
CREATE INDEX ix_professional_applications_status
  ON professional_applications (status, submitted_at);

--> statement-breakpoint

CREATE INDEX ix_professional_applications_user
  ON professional_applications (user_id);

--> statement-breakpoint

--
-- One *open* application per person, rather than one application per person.
--
-- A rejected application must be able to be replaced by a better one — that is
-- the entire point of telling somebody why they were refused — and the history
-- of both is worth keeping. What must not happen is the same person queuing
-- three times and ops reviewing the same business three times over.
--
CREATE UNIQUE INDEX uq_professional_applications_open
  ON professional_applications (user_id)
  WHERE deleted_at IS NULL
    AND status IN ('submitted', 'under_review', 'changes_requested');

--> statement-breakpoint

--
-- Row-level security, in the shape 0005 and 0007 established.
--
-- An application holds a person's business name, GST number and mobile, and it
-- holds the reviewer's note about them. The applicant may read their own row
-- and nothing else; a vendor has no business reading any of them, including the
-- one they were themselves approved from — that record is now ops history.
--
-- Absent settings mean no restriction, so ops, the jobs, the seed and the
-- migrations are unaffected; the actor test is wrapped in `(SELECT ...)` so it
-- is an InitPlan evaluated once rather than a call per row.
--
ALTER TABLE professional_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_applications FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS professional_applications_visible ON professional_applications;
CREATE POLICY professional_applications_visible ON professional_applications
  USING (
    (SELECT NOT app_actor_present())
    OR user_id = (SELECT app_user_id())
  );
