--
-- States, and the districts inside them.
--
-- Locations were flat: a `cities` row carried the state as free text, so
-- "Uttar Pradesh" and "UP" could diverge in exactly the way the table itself
-- exists to prevent. Nothing could be managed without SQL either — adding a
-- place the platform serves meant an INSERT by hand.
--
-- Each state becomes a row, and every district points at one. The `state` text
-- column stays for now, kept in step by every write: `City.state` is read by
-- the website, the app and the ops panel, and dropping it here would be the
-- city-to-district rename in disguise. That rename is worth doing on its own.
--
CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(80) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_states_slug" ON "states" USING btree ("slug");--> statement-breakpoint

--
-- One state per distinct name already in use, slugged the same way the
-- application slugs everything: lowercase, non-alphanumerics to hyphens, no
-- leading or trailing hyphen.
--
INSERT INTO "states" ("name", "slug")
SELECT DISTINCT "state", trim(both '-' from regexp_replace(lower("state"), '[^a-z0-9]+', '-', 'g'))
FROM "cities";--> statement-breakpoint

ALTER TABLE "cities" ADD COLUMN "state_id" uuid;--> statement-breakpoint

UPDATE "cities" SET "state_id" = s."id" FROM "states" s WHERE s."name" = "cities"."state";--> statement-breakpoint

-- Every city had a state — the column was NOT NULL — so this cannot fail on
-- existing data, and it stops a district being created adrift from now on.
ALTER TABLE "cities" ALTER COLUMN "state_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_states_id_fk"
	FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "ix_cities_state" ON "cities" USING btree ("state_id");
