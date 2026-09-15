--
-- Verification is complete when the first-step agreement is signed and every
-- required document has been submitted. Review can continue in the background;
-- optional documents and paper-copy logistics must not prevent a vendor from
-- receiving leads once the required set is present.
--

CREATE OR REPLACE VIEW eligible_vendors AS
  SELECT
    p.id AS professional_id,
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
    AND p.verification_status = 'verified';
