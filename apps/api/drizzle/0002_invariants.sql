-- Rules the ORM cannot express, and the ones that must not depend on a code
-- path remembering to run.
--
-- Everything here was previously enforced only by application code in
-- packages/data, and in several cases was enforced inconsistently or not at all.

/* ------------------------------------------------------------------ *
 * 1. A selected quote must belong to the service it was selected for
 * ------------------------------------------------------------------ */

-- `selectQuote` never checked that the quote id it was handed belonged to the
-- lead-domain being updated, so a quote from an unrelated requirement could be
-- selected — with its price, its vendor and its commission. A composite foreign
-- key makes that unrepresentable rather than merely unlikely.
ALTER TABLE "lead_domains"
  ADD CONSTRAINT "fk_lead_domain_selected_quote"
  FOREIGN KEY ("selected_quote_id", "id")
  REFERENCES "quotes" ("id", "lead_domain_id")
  ON DELETE SET NULL;

--> statement-breakpoint

-- The vendor recorded on the lead-domain must be the vendor whose quote won.
-- Not expressible as a foreign key, so a trigger.
CREATE OR REPLACE FUNCTION check_selected_quote_professional()
RETURNS trigger AS $$
DECLARE
  quote_professional uuid;
BEGIN
  IF NEW.selected_quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT professional_id INTO quote_professional FROM quotes WHERE id = NEW.selected_quote_id;

  IF NEW.selected_professional_id IS DISTINCT FROM quote_professional THEN
    RAISE EXCEPTION
      'selected_professional_id (%) does not match the professional on the selected quote (%)',
      NEW.selected_professional_id, quote_professional;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE TRIGGER trg_check_selected_quote_professional
  BEFORE INSERT OR UPDATE OF selected_quote_id, selected_professional_id ON lead_domains
  FOR EACH ROW EXECUTE FUNCTION check_selected_quote_professional();

--> statement-breakpoint

/* ------------------------------------------------------------------ *
 * 2. leads.overall_status is derived, so derive it here
 * ------------------------------------------------------------------ */

-- The status was documented as derived from the lead's services, but only three
-- of the seven mutations that changed a service status recomputed it. Signing an
-- agreement, submitting a quote and approving a stage all left the lead showing
-- a status it had outgrown. A trigger cannot be forgotten.
--
-- Precedence, unchanged from recomputeLeadStatus in packages/data:
--   archived is sticky           -> archived
--   every service ended          -> closed
--   any service past assignment  -> in_progress
--   a sales agent has claimed it -> verified
--   otherwise                    -> new
CREATE OR REPLACE FUNCTION recompute_lead_status(target_lead_id uuid)
RETURNS void AS $$
DECLARE
  total          int;
  ended          int;
  progressed     int;
  has_agent      boolean;
  current_status lead_status;
BEGIN
  SELECT overall_status, assigned_sales_agent_id IS NOT NULL
    INTO current_status, has_agent
    FROM leads WHERE id = target_lead_id;

  IF current_status = 'archived' THEN
    RETURN;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('completed', 'cancelled')),
    count(*) FILTER (WHERE status <> 'pending_assignment')
  INTO total, ended, progressed
  FROM lead_domains
  WHERE lead_id = target_lead_id AND deleted_at IS NULL;

  UPDATE leads SET
    overall_status = CASE
      WHEN total > 0 AND ended = total THEN 'closed'::lead_status
      WHEN progressed > 0             THEN 'in_progress'::lead_status
      WHEN has_agent                  THEN 'verified'::lead_status
      ELSE 'new'::lead_status
    END,
    updated_at = now()
  WHERE id = target_lead_id;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION trg_recompute_lead_status()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_lead_status(OLD.lead_id);
    RETURN OLD;
  END IF;

  PERFORM recompute_lead_status(NEW.lead_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE TRIGGER trg_lead_domain_status
  AFTER INSERT OR DELETE OR UPDATE OF status, deleted_at ON lead_domains
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_lead_status();

--> statement-breakpoint

-- Claiming a lead by logging the first call also promotes new -> verified, so
-- the agent column has to retrigger the same recompute.
CREATE OR REPLACE FUNCTION trg_lead_agent_claimed()
RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_sales_agent_id IS DISTINCT FROM OLD.assigned_sales_agent_id THEN
    PERFORM recompute_lead_status(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE TRIGGER trg_lead_agent
  AFTER UPDATE OF assigned_sales_agent_id ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_lead_agent_claimed();

--> statement-breakpoint

/* ------------------------------------------------------------------ *
 * 3. Project completion follows approved stages, and nothing else
 * ------------------------------------------------------------------ */

-- Two functions wrote completion_percent by different rules: ops approving
-- evidence, and a vendor-facing updateProjectProgress that took the number as
-- an argument. The second is gone. Completion is now computed from approved
-- milestones only, so "done" always means somebody checked.
CREATE OR REPLACE FUNCTION recompute_project_completion(target_project_id uuid)
RETURNS void AS $$
DECLARE
  total    int;
  approved int;
  pct      int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE verification = 'approved')
    INTO total, approved
    FROM project_milestones
    WHERE project_id = target_project_id AND deleted_at IS NULL;

  pct := CASE WHEN total = 0 THEN 0 ELSE round((approved::numeric / total) * 100) END;

  UPDATE projects SET
    completion_percent = pct,
    status = CASE WHEN pct = 100 AND status = 'ongoing' THEN 'completed'::project_status
                  ELSE status END,
    actual_end_date = CASE WHEN pct = 100 AND actual_end_date IS NULL THEN current_date
                           ELSE actual_end_date END,
    updated_at = now()
  WHERE id = target_project_id;

  -- A finished project finishes its service, which the lead status trigger
  -- then picks up on its own.
  IF pct = 100 THEN
    UPDATE lead_domains SET status = 'completed', updated_at = now()
    WHERE id = (SELECT lead_domain_id FROM projects WHERE id = target_project_id)
      AND status <> 'completed';
  END IF;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION trg_recompute_project_completion()
RETURNS trigger AS $$
BEGIN
  PERFORM recompute_project_completion(COALESCE(NEW.project_id, OLD.project_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE TRIGGER trg_milestone_verification
  AFTER INSERT OR DELETE OR UPDATE OF verification, deleted_at ON project_milestones
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_project_completion();

--> statement-breakpoint

/* ------------------------------------------------------------------ *
 * 4. Rating caches follow the reviews they summarise
 * ------------------------------------------------------------------ */

-- Ratings drive vendor ranking in every pool and listing, so they must never
-- drift from the reviews underneath them.
CREATE OR REPLACE FUNCTION recompute_ratings(target_professional_id uuid, target_domain_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE professional_domains pd SET
    avg_rating_x10 = COALESCE((
      SELECT round(avg(r.rating) * 10)
      FROM reviews r
      WHERE r.professional_id = target_professional_id
        AND r.domain_id = target_domain_id AND r.deleted_at IS NULL
    ), 0),
    rating_count = (
      SELECT count(*) FROM reviews r
      WHERE r.professional_id = target_professional_id
        AND r.domain_id = target_domain_id AND r.deleted_at IS NULL
    ),
    updated_at = now()
  WHERE pd.professional_id = target_professional_id AND pd.domain_id = target_domain_id;

  UPDATE professionals p SET
    avg_rating_x10 = COALESCE((
      SELECT round(avg(r.rating) * 10) FROM reviews r
      WHERE r.professional_id = target_professional_id AND r.deleted_at IS NULL
    ), 0),
    rating_count = (
      SELECT count(*) FROM reviews r
      WHERE r.professional_id = target_professional_id AND r.deleted_at IS NULL
    ),
    updated_at = now()
  WHERE p.id = target_professional_id;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION trg_recompute_ratings()
RETURNS trigger AS $$
BEGIN
  PERFORM recompute_ratings(
    COALESCE(NEW.professional_id, OLD.professional_id),
    COALESCE(NEW.domain_id, OLD.domain_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE TRIGGER trg_review_ratings
  AFTER INSERT OR DELETE OR UPDATE OF rating, deleted_at ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_ratings();

--> statement-breakpoint

/* ------------------------------------------------------------------ *
 * 5. completed_projects counters, which nothing maintained
 * ------------------------------------------------------------------ */

-- professional_domains.completed_projects was read on the vendor profile and
-- the pool ranking but written nowhere, so it showed whatever the seed data
-- happened to say.
CREATE OR REPLACE FUNCTION trg_project_completed_counter()
RETURNS trigger AS $$
DECLARE
  target_domain uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT domain_id INTO target_domain FROM lead_domains WHERE id = NEW.lead_domain_id;

    UPDATE professional_domains SET
      completed_projects = completed_projects + 1, updated_at = now()
    WHERE professional_id = NEW.professional_id AND domain_id = target_domain;

    UPDATE professionals SET
      completed_projects = completed_projects + 1, updated_at = now()
    WHERE id = NEW.professional_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE TRIGGER trg_project_completed
  AFTER UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION trg_project_completed_counter();

--> statement-breakpoint

/* ------------------------------------------------------------------ *
 * 6. One definition of "eligible for leads"
 * ------------------------------------------------------------------ */

-- The rule existed twice in the frontend — once as the vendor pool filter and
-- once as the onboarding checklist — and the two could disagree about whether
-- a given vendor was assignable. One view, consulted by both.
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
  WHERE p.verification_status = 'verified'
    AND p.deleted_at IS NULL;

--> statement-breakpoint

/* ------------------------------------------------------------------ *
 * 7. Search indexes
 * ------------------------------------------------------------------ */

CREATE INDEX ix_product_name_trgm    ON products    USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX ix_blog_title_trgm      ON blog_posts  USING gin (title gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX ix_professional_company_trgm ON professionals USING gin (company_name gin_trgm_ops);
