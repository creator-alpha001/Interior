--
-- Approved is not verified.
--
-- Until now approving an application created the vendor already verified, and
-- the only agreement was a set of ticked clauses and a typed name. That records
-- consent; it is not what a vendor who wants to walk away from a deal can be
-- held to. What can is the standard agreement signed on paper, the original in
-- our hands, and documents that identify the business that signed it.
--
-- So approval now creates the vendor `pending`, and `verified` means all of that
-- has been received and accepted. `eligible_vendors` already requires
-- `verified`, so an approved vendor is in no lead pool until the paperwork is
-- done — the rule is enforced by the view that was already there, not by a new
-- one. Vendors verified before this migration keep their status; ops ask them
-- for the paperwork and can move any of them back to pending.
--
-- Nothing here changes existing rows except to add columns with defaults.
--

ALTER TYPE upload_purpose ADD VALUE IF NOT EXISTS 'agreement_template';

--> statement-breakpoint

CREATE TYPE partner_signed_copy_status AS ENUM ('not_submitted', 'submitted', 'accepted', 'rejected');

--> statement-breakpoint

CREATE TYPE partner_hardcopy_method AS ENUM ('courier', 'in_person');

--> statement-breakpoint

CREATE TYPE partner_hardcopy_status AS ENUM ('not_sent', 'dispatched', 'received');

--> statement-breakpoint

CREATE TYPE vendor_document_kind AS ENUM (
  'pan',
  'gst_certificate',
  'business_registration',
  'signatory_id',
  'address_proof'
);

--> statement-breakpoint

CREATE TYPE vendor_document_status AS ENUM ('submitted', 'accepted', 'rejected');

--> statement-breakpoint

-- The standard agreement PDF for each version, and where originals are sent.
-- The URL is kept on the row because vendors read it under row-level security,
-- and the media row behind it was uploaded by staff.
ALTER TABLE partner_terms
  ADD COLUMN document_url text,
  ADD COLUMN document_media_id uuid REFERENCES media_assets(id),
  ADD COLUMN hardcopy_instructions text NOT NULL DEFAULT '';

--> statement-breakpoint

ALTER TABLE partner_agreements
  ADD COLUMN signed_copy_status partner_signed_copy_status NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN signed_copy_submitted_at timestamptz,
  ADD COLUMN stamp_certificate_number varchar(60),
  ADD COLUMN signed_copy_reviewed_at timestamptz,
  ADD COLUMN signed_copy_reviewed_by_user_id uuid REFERENCES users(id),
  ADD COLUMN signed_copy_review_note text,
  ADD COLUMN hardcopy_method partner_hardcopy_method,
  ADD COLUMN hardcopy_status partner_hardcopy_status NOT NULL DEFAULT 'not_sent',
  ADD COLUMN hardcopy_courier text,
  ADD COLUMN hardcopy_tracking_number varchar(80),
  ADD COLUMN hardcopy_dispatched_at timestamptz,
  ADD COLUMN hardcopy_received_at timestamptz,
  ADD COLUMN hardcopy_received_by_user_id uuid REFERENCES users(id),
  ADD COLUMN hardcopy_note text;

--> statement-breakpoint

CREATE TABLE vendor_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  kind vendor_document_kind NOT NULL,
  -- PAN, GSTIN or registration number. The API refuses a full Aadhaar number.
  document_number varchar(40),
  status vendor_document_status NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES users(id),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

--> statement-breakpoint

-- One live document of each kind per vendor. A replacement soft-deletes the one
-- before it, so what was shown to us and when stays on record.
CREATE UNIQUE INDEX uq_vendor_documents_live
  ON vendor_documents (professional_id, kind)
  WHERE deleted_at IS NULL;

--> statement-breakpoint

CREATE INDEX ix_vendor_documents_review ON vendor_documents (status, submitted_at);

--> statement-breakpoint

--
-- Row-level security, in the shape 0005, 0007 and 0013 established.
--
-- A PAN card and an ID are about as personal as anything this database holds. A
-- vendor reads and writes their own; nobody else with a scope reads any of them.
-- Absent settings mean no restriction, so ops, jobs and migrations are unaffected.
--
ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

ALTER TABLE vendor_documents FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS vendor_documents_own ON vendor_documents;

--> statement-breakpoint

CREATE POLICY vendor_documents_own ON vendor_documents
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
  )
  WITH CHECK (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
  );

--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_documents TO aangan_app;

--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_documents TO aangan_ops;
