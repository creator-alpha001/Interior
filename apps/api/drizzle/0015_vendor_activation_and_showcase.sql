--
-- Leads on the signed original; the badge on the documents.
--
-- 0014 made `verified` the gate to every lead pool, and `verified` waited for
-- everything — the signed original and every ID document. That made the least
-- urgent paperwork the thing stopping a vendor from earning. The agreement is
-- what binds them; once its signed original is in our hands they can work.
--
-- So a pending vendor is now eligible once they have accepted the current terms
-- online and the original has been marked received — and stays eligible while
-- every required ID document has been sent, or for 7 days after the original
-- arrived, whichever lasts longer. Miss the 7 days and they drop out of every
-- pool until the documents are sent; nothing else about their account changes.
-- The Verified badge still waits for everything to be accepted.
--
-- 7 days is also `DOCUMENT_GRACE_DAYS` in apps/api/src/modules/vendor/paperwork.ts.
-- Change both together.
--
-- Also here, because vendors can now post them: review columns on portfolio
-- items, and a table for achievements.
--

CREATE OR REPLACE VIEW eligible_vendors AS
  SELECT
    p.id  AS professional_id,
    pd.domain_id,
    sa.city_id
  FROM professionals p
  JOIN professional_domains pd
    ON pd.professional_id = p.id
   AND pd.verification_status = 'approved'
   AND pd.deleted_at IS NULL
  JOIN professional_service_areas sa
    ON sa.professional_id = p.id
   AND sa.deleted_at IS NULL
  JOIN partner_agreements pa
    ON pa.professional_id = p.id
   AND pa.status = 'signed'
   AND pa.terms_version = (SELECT version FROM partner_terms WHERE is_current)
   AND pa.deleted_at IS NULL
  WHERE p.deleted_at IS NULL
    AND (
      p.verification_status = 'verified'
      OR (
        p.verification_status = 'pending'
        AND pa.hardcopy_status = 'received'
        AND (
          pa.hardcopy_received_at + interval '7 days' > now()
          OR NOT EXISTS (
            SELECT 1
            FROM unnest(
              ARRAY['pan', 'business_registration', 'signatory_id', 'address_proof']::vendor_document_kind[]
              || CASE
                   WHEN coalesce(p.gst_number, '') <> '' THEN ARRAY['gst_certificate']::vendor_document_kind[]
                   ELSE ARRAY[]::vendor_document_kind[]
                 END
            ) AS required(kind)
            WHERE NOT EXISTS (
              SELECT 1 FROM vendor_documents d
              WHERE d.professional_id = p.id
                AND d.kind = required.kind
                AND d.deleted_at IS NULL
                AND d.status IN ('submitted', 'accepted')
            )
          )
        )
      )
    );

--> statement-breakpoint

ALTER TABLE portfolio_items
  ADD COLUMN city_id uuid REFERENCES cities(id),
  ADD COLUMN review_note text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by_user_id uuid REFERENCES users(id);

--> statement-breakpoint

CREATE TYPE vendor_achievement_kind AS ENUM ('award', 'certification', 'membership', 'press', 'other');

--> statement-breakpoint

CREATE TABLE vendor_achievements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  kind vendor_achievement_kind NOT NULL,
  title text NOT NULL,
  issuer text NOT NULL DEFAULT '',
  year integer,
  description text NOT NULL DEFAULT '',
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

--> statement-breakpoint

CREATE INDEX ix_vendor_achievements_professional ON vendor_achievements (professional_id);

--> statement-breakpoint

CREATE INDEX ix_vendor_achievements_review
  ON vendor_achievements (moderation_status, created_at)
  WHERE deleted_at IS NULL;

--> statement-breakpoint

-- A vendor manages their own; anyone may read an approved one, which is what a
-- public profile shows. Absent settings mean no restriction, as everywhere.
ALTER TABLE vendor_achievements ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

ALTER TABLE vendor_achievements FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS vendor_achievements_visible ON vendor_achievements;

--> statement-breakpoint

CREATE POLICY vendor_achievements_visible ON vendor_achievements
  USING (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
    OR moderation_status = 'approved'
  )
  WITH CHECK (
    (SELECT NOT app_actor_present())
    OR professional_id = (SELECT app_professional_id())
  );

--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_achievements TO aangan_app;

--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_achievements TO aangan_ops;

--> statement-breakpoint

-- The photograph of a certificate is shown on a public profile like a portfolio
-- photograph, so it is readable the same way. Otherwise identical to 0007.
DROP POLICY IF EXISTS media_visible ON media_assets;

--> statement-breakpoint

CREATE POLICY media_visible ON media_assets
  USING (
    (SELECT NOT app_actor_present())
    OR uploaded_by_user_id = (SELECT app_user_id())
    OR owner_type IN ('product', 'service_package', 'blog_post', 'portfolio_item', 'vendor_achievement')
    OR (
      owner_type = 'project_milestone'
      AND app_party_to_project((
        SELECT m.project_id FROM project_milestones m WHERE m.id = media_assets.owner_id
      ))
    )
  );
