-- Searching the lead queue.
--
-- The queue searches a reference, a description and the customer's name with a
-- leading wildcard — "find LD-1042", "find the Gomti Nagar kitchen". No btree
-- index can serve `LIKE '%...%'`, so at fifty thousand leads every search read
-- the whole table: 355ms, and rising linearly with the business.
--
-- Trigram indexes do serve it. The catalogue and the blog already had these;
-- leads did not, because with a dozen rows in the seed nothing was slow enough
-- to notice.
--
-- Measured on the load-test database, 50,006 leads: 355ms to 5ms.

CREATE INDEX IF NOT EXISTS ix_lead_reference_trgm
  ON leads USING gin (lower(reference) gin_trgm_ops);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ix_lead_description_trgm
  ON leads USING gin (lower(description) gin_trgm_ops);
