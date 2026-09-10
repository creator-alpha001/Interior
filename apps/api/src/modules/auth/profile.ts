/**
 * Changing the things somebody was allowed to skip at signup.
 *
 * Signup asks for a city and explains why it matters, and offers a phone number
 * without insisting. Neither is a wall, so both have to be answerable later —
 * otherwise "you can do this afterwards" is a promise the API cannot keep, and
 * the skip button is a trap rather than a choice.
 *
 * Everything here is scoped by the session's user id. None of these functions
 * takes a user id from the caller, which is what stops a signed-in person
 * setting a city or attaching a number on somebody else's account.
 */
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors";

/**
 * Sets or clears the name and city.
 *
 * `cityId` distinguishes absent from null: absent leaves the city alone, null
 * clears it back to "not told". Clearing is a real thing to want — somebody who
 * picked a city to see its prices and then moved should be able to go back to
 * seeing everything, and a settings screen that can only ever narrow is one
 * people stop trusting.
 */
export async function updateProfile(
  userId: string,
  input: { name?: string; cityId?: string | null },
): Promise<void> {
  const patch: { name?: string; cityId?: string | null } = {};

  if (input.name !== undefined) patch.name = input.name.trim();

  if (input.cityId !== undefined) {
    if (input.cityId !== null) {
      // Checked rather than left to the foreign key, so a stale city id from a
      // cached page reads as "that city is not available" instead of surfacing
      // a constraint name.
      const [city] = await db
        .select({ id: t.cities.id, isActive: t.cities.isActive })
        .from(t.cities)
        .where(eq(t.cities.id, input.cityId))
        .limit(1);

      if (!city) throw new NotFoundError("That city");
      if (!city.isActive) throw new ValidationError("We are not operating in that city yet");
    }
    patch.cityId = input.cityId;
  }

  if (Object.keys(patch).length === 0) return;

  await db
    .update(t.users)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(t.users.id, userId));
}

/**
 * Refuses a number that is already somebody else's, before a code is sent.
 *
 * The unique index would catch it either way, but only after the SMS had gone
 * out and been typed back in — so the person would pay for the round trip to be
 * told no at the very end. Worse, an account can only hold one number, so the
 * failure would arrive with no way forward and no explanation of why.
 *
 * Checking here does leak that a number is in use, to somebody who has already
 * signed in. That is the same thing the sign-in page leaks to anybody at all by
 * sending a code to a number that turns out to have an account, and the
 * alternative is failing after the SMS instead of before it.
 */
export async function assertMobileAvailable(userId: string, mobile: string): Promise<void> {
  const [taken] = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.mobile, mobile), ne(t.users.id, userId), isNull(t.users.deletedAt)))
    .limit(1);

  if (taken) {
    throw new ConflictError(
      "That number is already on another account. Sign in with it instead, or use a different number.",
    );
  }
}

/**
 * Attaches a number the session's owner has just proved.
 *
 * The write is conditional on the number still being free. Between the check
 * before the SMS and the code coming back, somebody else could have completed
 * the same number through the sign-in flow — a real race over a couple of
 * minutes, not a theoretical one, because that is exactly how long an OTP
 * takes. The unique index is the backstop and this is the readable answer.
 */
export async function attachVerifiedMobile(userId: string, mobile: string): Promise<void> {
  await assertMobileAvailable(userId, mobile);

  await db
    .update(t.users)
    .set({
      mobile,
      mobileVerifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(t.users.id, userId));
}
