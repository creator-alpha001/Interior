--
-- Capture the vendor agreement at the first application step.
--
-- Existing applications remain readable and can be reviewed, but new
-- applications record the exact terms version, signature and clause
-- acknowledgements before they enter the approval queue. Approval materialises
-- those values into partner_agreements once a professional row exists.
--

ALTER TABLE professional_applications
  ADD COLUMN agreement_terms_version varchar(20),
  ADD COLUMN agreement_signature_text text,
  ADD COLUMN agreement_signatory_name text,
  ADD COLUMN agreement_signatory_role text,
  ADD COLUMN agreement_acknowledged_clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN agreement_signed_at timestamptz,
  ADD COLUMN agreement_signed_from_ip varchar(45),
  ADD COLUMN agreement_signed_user_agent text;

--> statement-breakpoint

ALTER TABLE professional_applications
  ADD CONSTRAINT professional_applications_agreement_terms_fk
  FOREIGN KEY (agreement_terms_version) REFERENCES partner_terms(version);
