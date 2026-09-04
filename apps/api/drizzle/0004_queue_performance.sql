-- Indexes the ops queue and the day screens actually need.
--
-- Everything here came out of a load test against fifty thousand leads, not out
-- of a guess. The seed has a dozen leads, so until that test existed none of
-- these queries had ever met a table large enough to have an opinion about
-- them. Four of six screens were over a 300ms budget; the plans showed why.

-- The queue's sort order is an expression — urgency ranked by how soon the
-- customer needs somebody, then oldest first — so an index on the urgency
-- column cannot serve it. This indexes the expression itself.
--
-- Partial on deleted_at because every queue query carries that predicate, which
-- keeps the index to live rows and lets it answer the ordering directly instead
-- of sorting fifty thousand rows per page.
CREATE INDEX IF NOT EXISTS ix_lead_queue_order ON leads (
  (CASE urgency
     WHEN 'immediate' THEN 0
     WHEN 'within_month' THEN 1
     ELSE 2
   END),
  created_at
) WHERE deleted_at IS NULL;

--> statement-breakpoint

-- The same ordering, within one agent's queue. My Day and the agent's own view
-- always filter by agent first.
CREATE INDEX IF NOT EXISTS ix_lead_agent_queue ON leads (
  assigned_sales_agent_id,
  (CASE urgency
     WHEN 'immediate' THEN 0
     WHEN 'within_month' THEN 1
     ELSE 2
   END),
  created_at
) WHERE deleted_at IS NULL;

--> statement-breakpoint

-- "How many services are waiting to be assigned" is now answered by starting
-- from the waiting services rather than by asking that question once per lead.
-- The existing index led with status and then domain_id, which does not help a
-- query that groups by lead.
CREATE INDEX IF NOT EXISTS ix_lead_domain_status_lead ON lead_domains (status, lead_id)
  WHERE deleted_at IS NULL;

--> statement-breakpoint

-- "Which customers are waiting on a reply" used to run a sequential scan of
-- every message once per lead. Starting from the messages instead needs the
-- channel and the sender to be the leading columns.
CREATE INDEX IF NOT EXISTS ix_message_thread_latest ON messages (lead_domain_id, channel, sender_role, created_at DESC);

--> statement-breakpoint

-- Follow-ups due, per agent, without visiting every lead they own.
CREATE INDEX IF NOT EXISTS ix_activity_followup_lead ON lead_sales_activities (follow_up_date, lead_id)
  WHERE follow_up_date IS NOT NULL AND deleted_at IS NULL;

--> statement-breakpoint

-- The dashboard counts leads by status for one agent, or for everybody.
CREATE INDEX IF NOT EXISTS ix_lead_agent_status ON leads (assigned_sales_agent_id, overall_status)
  WHERE deleted_at IS NULL;

--> statement-breakpoint

-- Serves "the last message in each customer thread", which is how the awaiting-
-- reply count is computed. Leading with the channel because that is the filter,
-- then the thread and the ordering the DISTINCT ON needs.
CREATE INDEX IF NOT EXISTS ix_message_latest_per_thread ON messages (channel, lead_domain_id, created_at DESC)
  WHERE deleted_at IS NULL;
