-- Push notifications, and the columns that keep the outbox honest.
--
-- `device_tokens` has existed since 0001 and nothing has ever read it. Four
-- columns turn it from a place to put a token into something a dispatcher can
-- work from without sending to dead handsets forever:
--
--   session_id     which sign-in this token belongs to, so signing out removes
--                  exactly this device rather than every device the person owns.
--                  A recycled handset receiving the previous owner's leads is
--                  the failure this prevents
--   app_version    which build, for reading a crash against a version
--   last_seen_at   when the app last said hello, so stale rows are visible
--   failure_count  consecutive rejections
--   disabled_at    set when the provider says the token is dead (Firebase
--                  answers UNREGISTERED for an uninstalled app). Excluded from
--                  every send, rather than retried every two minutes forever

ALTER TABLE device_tokens
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ix_device_user ON device_tokens (user_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ix_device_session ON device_tokens (session_id);

--> statement-breakpoint

-- The dispatcher reads live tokens only, and reads them for a batch of users at
-- a time. Partial, because a disabled row is never selected.
CREATE INDEX IF NOT EXISTS ix_device_live
  ON device_tokens (user_id)
  WHERE disabled_at IS NULL;

--> statement-breakpoint

-- What actually happened to a notification.
--
-- `dispatched_at` has always meant "the job has looked at this", not "the
-- person heard about it" — the two differ whenever SMS is unconfigured, a
-- handset is dead or a number is rejected, which is most of the time before an
-- SMS account exists. Recording the outcome makes "did the customer hear about
-- this?" a question the database answers rather than one somebody greps for.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS delivery_channel text,
  ADD COLUMN IF NOT EXISTS delivery_note text;
