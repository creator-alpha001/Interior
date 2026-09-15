-- Customer and professional passwords are deliberately separate from staff
-- credentials. Staff sign in by email and may require TOTP; public users sign
-- in by an already verified mobile number and never enter the staff path.
CREATE TABLE IF NOT EXISTS "user_password_credentials" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "password_hash" text NOT NULL,
  "password_changed_at" timestamptz DEFAULT now() NOT NULL,
  "failed_attempts" smallint DEFAULT 0 NOT NULL,
  "locked_until" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_password_credentials_user"
  ON "user_password_credentials" ("user_id");
