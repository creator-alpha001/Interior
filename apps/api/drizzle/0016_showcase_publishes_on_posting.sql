--
-- Work and achievements publish when posted, not when approved.
--
-- Both tables defaulted to `pending`, so a vendor who photographed a finished
-- kitchen and posted it saw an empty public profile until somebody at Decora
-- Shine worked a queue. The feature read as broken, and the profiles customers
-- browse stayed bare — which is the opposite of what the queue was protecting.
--
-- Ops keep the same lever, pointing the other way: `rejected` takes an item
-- down, with a note the vendor reads. Nothing about the review routes changes.
--
-- Everything already waiting is published. Those vendors posted work under a
-- promise that somebody would look at it; leaving them pending under a policy
-- that no longer has a queue behind it would strand them for ever. Ops can
-- take down anything that should not have gone up, which is exactly the power
-- the new default assumes.
--
ALTER TABLE "portfolio_items" ALTER COLUMN "moderation_status" SET DEFAULT 'approved';--> statement-breakpoint
ALTER TABLE "vendor_achievements" ALTER COLUMN "moderation_status" SET DEFAULT 'approved';--> statement-breakpoint
UPDATE "portfolio_items" SET "moderation_status" = 'approved' WHERE "moderation_status" = 'pending';--> statement-breakpoint
UPDATE "vendor_achievements" SET "moderation_status" = 'approved' WHERE "moderation_status" = 'pending';--> statement-breakpoint

--
-- What a job posting carries besides a title and a paragraph.
--
-- `highlights` is the handful of lines a customer skims — materials, size, how
-- long it took. `details` is the long description, written in a rich text
-- editor and stored as HTML that `lib/html.ts` has already sanitised, so every
-- reader — the site, the ops panel and the phone, which renders HTML through a
-- different engine entirely — is safe without each having to remember.
--
ALTER TABLE "portfolio_items" ADD COLUMN "highlights" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "details" text DEFAULT '' NOT NULL;
