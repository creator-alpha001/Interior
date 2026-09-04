-- Who logged a call.
--
-- `sales_agent_id` is a foreign key to `sales_agents`, and admins have no row
-- there — so an admin logging a call hit a foreign key violation and a 500. The
-- attribution was wrong in principle too: the column answers "which agent owns
-- this lead", not "who made this call", and for anybody who is not an agent
-- there was no honest answer to the second question.
--
-- So the agent stays optional, and every row gains the user who actually did
-- it. A call log that cannot say who made the call is not much of a log.

ALTER TABLE "lead_sales_activities"
  ALTER COLUMN "sales_agent_id" DROP NOT NULL;

--> statement-breakpoint

ALTER TABLE "lead_sales_activities"
  ADD COLUMN "logged_by_user_id" uuid REFERENCES "users" ("id");

--> statement-breakpoint

-- Existing rows were all logged by an agent, so backfill from that.
UPDATE "lead_sales_activities" a
SET "logged_by_user_id" = sa.user_id
FROM "sales_agents" sa
WHERE sa.id = a.sales_agent_id AND a."logged_by_user_id" IS NULL;

--> statement-breakpoint

-- One of the two must identify somebody. A row that names neither is an
-- unattributable entry in what is meant to be an accountability record.
ALTER TABLE "lead_sales_activities"
  ADD CONSTRAINT "ck_activity_attributed"
  CHECK ("sales_agent_id" IS NOT NULL OR "logged_by_user_id" IS NOT NULL);

--> statement-breakpoint

CREATE INDEX "ix_activity_logged_by" ON "lead_sales_activities" ("logged_by_user_id");
