/**
 * Creates a real staff account, or resets the password on one.
 *
 * The ops panel now has a sign-in, which means it needs accounts that are not
 * the seed's `admin@example.com`. This is how one is made.
 *
 *   STAFF_EMAIL=you@yourdomain.com STAFF_NAME="Your Name" \
 *   STAFF_PASSWORD='...' npm run staff -w api
 *
 * The password is read from the environment rather than taken as an argument,
 * so it does not end up in shell history or in the process list where every
 * other user on the machine can read it. It is never logged, and only its
 * argon2 hash is stored — the same hash `authenticateStaff` verifies against,
 * so an account made here is indistinguishable from a seeded one.
 *
 * Runs as the owner, like the seed and the migrations: `staff_credentials` is
 * behind row-level security and the application role deliberately cannot write
 * to it.
 */
import "./as-owner";
import argon2 from "argon2";
import { and, eq, isNull } from "drizzle-orm";
import { closeDatabase, db, transaction } from "./client";
import * as t from "./schema";

type Role = "admin" | "sales_agent";

async function main(): Promise<void> {
  const email = process.env.STAFF_EMAIL?.trim().toLowerCase();
  const password = process.env.STAFF_PASSWORD;
  const name = process.env.STAFF_NAME?.trim();
  const role = (process.env.STAFF_ROLE?.trim() as Role | undefined) ?? "admin";

  if (!email || !password) {
    throw new Error(
      "Set STAFF_EMAIL and STAFF_PASSWORD.\n\n" +
        "  STAFF_EMAIL=you@yourdomain.com STAFF_NAME=\"Your Name\" \\\n" +
        "  STAFF_PASSWORD='a long one' npm run staff -w api\n",
    );
  }

  /*
   * Twelve is the same floor the API applies when a password is *set*, and it
   * belongs here rather than at sign-in: a minimum length checked while
   * verifying would tell an attacker how short a guess is not worth making.
   */
  if (password.length < 12) {
    throw new Error("That password is too short — use at least 12 characters.");
  }
  if (role !== "admin" && role !== "sales_agent") {
    throw new Error(`STAFF_ROLE must be "admin" or "sales_agent", not "${role}".`);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(t.users)
      .where(and(eq(t.users.email, email), isNull(t.users.deletedAt)))
      .limit(1);

    let userId: string;

    if (existing) {
      /*
       * An existing account is promoted rather than duplicated. `users.email`
       * carries a partial unique index, so a second row would be refused — and
       * silently making a second admin with the same address would be worse
       * than the error.
       */
      userId = existing.id;
      await tx
        .update(t.users)
        .set({
          role,
          name: name ?? existing.name,
          status: "active",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(t.users.id, userId));
      console.log(`Updated the existing account for ${email} (${existing.name}).`);
    } else {
      const [created] = await tx
        .insert(t.users)
        .values({
          name: name ?? email.split("@")[0]!,
          email,
          mobile: null,
          role,
          status: "active",
        })
        .returning({ id: t.users.id });
      userId = created!.id;
      console.log(`Created ${email}.`);
    }

    // A sales agent needs the row its actor id comes from; without it
    // `authenticateStaff` refuses the sign-in it would otherwise allow.
    if (role === "sales_agent") {
      const [agent] = await tx
        .select({ id: t.salesAgents.id })
        .from(t.salesAgents)
        .where(eq(t.salesAgents.userId, userId))
        .limit(1);
      if (!agent) {
        await tx.insert(t.salesAgents).values({ userId, assignedCityIds: [], dailyTarget: 0 });
      }
    }

    const [credentials] = await tx
      .select({ id: t.staffCredentials.id })
      .from(t.staffCredentials)
      .where(eq(t.staffCredentials.userId, userId))
      .limit(1);

    if (credentials) {
      await tx
        .update(t.staffCredentials)
        .set({
          passwordHash,
          passwordChangedAt: new Date().toISOString(),
          // A password reset clears a lockout. Somebody who has just proved
          // they can set the password is not the attacker it was defending
          // against, and leaving them locked out is a support call.
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(t.staffCredentials.id, credentials.id));
      console.log("Password reset.");
    } else {
      await tx.insert(t.staffCredentials).values({ userId, passwordHash });
      console.log("Password set.");
    }
  });

  console.log(`\n  ${email} can now sign in to the ops panel as ${role}.`);
  console.log("  Two-factor is not set up by this script — add it from the panel.\n");
}

main()
  .then(async () => {
    await closeDatabase();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
