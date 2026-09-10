--
-- A mobile number and a city stop being conditions of having an account.
--
-- Until now `users.mobile` was NOT NULL on the reasoning that ops ring every
-- customer about their lead, so an account nobody can telephone is not one this
-- business can serve. That is still true of a *lead* — and it is still enforced
-- where it belongs, on the requirement, which asks for a city and where ops get
-- the number from the customer on the call. It was never true of an *account*.
--
-- Applied to signup it produced the thing this migration exists to remove: a
-- person who had just proved who they are to Google was shown a page demanding
-- a phone number before anything at all would work, with no way past it. The
-- number is worth asking for and worth verifying; it is not worth losing the
-- signup over, and somebody who declines today can be asked again after they
-- have a reason to say yes.
--
-- The same applies to the city, with one difference: a null city is not a gap
-- to be papered over with a guess. `actorForMobile` used to fall back to the
-- first active city, which is silent and almost always wrong — prices, vendors
-- and availability are per city, so it showed a Lucknow customer a Bengaluru
-- catalogue and said nothing. Null now means "we have not been told", and the
-- catalogue answers that honestly by showing every city until it is.
--

ALTER TABLE users ALTER COLUMN mobile DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE users ALTER COLUMN city_id DROP NOT NULL;
--> statement-breakpoint

-- The unique index has to stop treating "no number" as a number.
--
-- Postgres already lets many NULLs coexist under a unique index, so this would
-- work either way; the predicate is here so the index does not carry a row per
-- account that has no number, and so the intent is legible next to the column
-- that just became nullable.
DROP INDEX IF EXISTS uq_users_mobile;
--> statement-breakpoint

CREATE UNIQUE INDEX uq_users_mobile
  ON users (mobile)
  WHERE deleted_at IS NULL AND mobile IS NOT NULL;
--> statement-breakpoint

--
-- When the number was last proved by a code.
--
-- Presence of `mobile` is not by itself proof: ops type numbers into the admin
-- panel from a phone call, and a number typed by somebody else is exactly the
-- one worth re-checking before it is used to authenticate. Splitting the two
-- lets a screen say "add and verify" rather than showing an unverified number
-- as though the account holder had confirmed it.
--
ALTER TABLE users ADD COLUMN mobile_verified_at timestamptz;
--> statement-breakpoint

-- Every number that exists today arrived through the OTP flow, which is the
-- only writer of this column that ever ran. Backfilling to the account's own
-- creation time is therefore accurate rather than convenient: it records that
-- the number was proved, without inventing a moment it was not.
UPDATE users SET mobile_verified_at = created_at WHERE mobile IS NOT NULL;
