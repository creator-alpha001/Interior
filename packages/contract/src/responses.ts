/**
 * Response shapes that belong to an endpoint rather than to an entity.
 *
 * Entity and view-model shapes live in `@repo/types/schema` and are imported
 * wholesale. What is left is the handful of envelopes a particular endpoint
 * invents — a counts rollup, a stats strip, an acknowledgement — plus the
 * pagination wrapper. Those are defined here, next to the routes that return
 * them, rather than polluting the domain vocabulary.
 */
import { z } from "zod";
import {
  actorSchema,
  agreementSchema,
  idSchema,
  meetingSchema,
  messageSchema,
  paginatedSchema,
  partnerAgreementSchema,
  portfolioItemSchema,
  projectSchema,
  quoteSchema,
  referralSchema,
  reviewSchema,
  rupeesSchema,
  supportTicketSchema,
  timestampSchema,
  vendorLeadCardSchema,
} from "@repo/types/schema";

export { paginatedSchema };

/**
 * A bare acknowledgement.
 *
 * Several mutations have nothing useful to return. They say so explicitly
 * rather than answering an empty body, because a client that cannot tell
 * "succeeded with no payload" from "succeeded and the payload was dropped" has
 * to guess.
 */
export const okSchema = z.object({ ok: z.literal(true) });

export const countSchema = z.object({ count: z.number() });

/* ---------------- auth ---------------- */

export const otpChallengeSchema = z.object({
  challengeId: idSchema,
  expiresInSeconds: z.number(),
  /**
   * Present only when OTP_DEV_ECHO is on, which the config refuses to allow in
   * production. Documented because a mobile client in development reads it.
   */
  devCode: z.string().optional(),
});

/**
 * Who you are, plus a bearer token when the caller asked for one.
 *
 * The web gets a cookie and just the actor. A mobile client sends
 * `X-Client: mobile` and gets the same session's token in the body — same row,
 * same revocation, not a JWT. Modelled as one discriminated union rather than
 * two response types so the generated Dart has a single `switch` on `role`.
 */
const sessionFields = {
  sessionToken: z.string().optional(),
  expiresAt: timestampSchema.optional(),
};

export const authSessionSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("client"), userId: idSchema, clientId: idSchema, ...sessionFields }),
  z.object({
    role: z.literal("professional"),
    userId: idSchema,
    professionalId: idSchema,
    ...sessionFields,
  }),
  z.object({
    role: z.literal("sales_agent"),
    userId: idSchema,
    salesAgentId: idSchema,
    ...sessionFields,
  }),
  z.object({ role: z.literal("admin"), userId: idSchema, ...sessionFields }),
]);

export { actorSchema };

/** `GET /app/version` — the only lever there is once a bad build is on a phone. */
export const appVersionSchema = z.object({
  minBuild: z.number(),
  message: z.string(),
});

/**
 * What closing an account actually did.
 *
 * `retained` is not padding: closure clears personal detail and soft-deletes
 * the row, but agreements, invoices and reviews stay, because they are
 * commercial records with a second party. The app says so rather than implying
 * a purge that did not happen.
 */
export const accountClosureSchema = z.object({
  closedAt: timestampSchema,
  retained: z.array(z.string()),
});

/* ---------------- uploads ---------------- */

/**
 * An upload ticket. The client PUTs the bytes straight at `uploadUrl` and then
 * submits `assetId` with the form — photographs never pass through the API.
 */
export const uploadTicketSchema = z.object({
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
  assetId: idSchema,
  publicUrl: z.string(),
});

/* ---------------- public catalogue ---------------- */

export const catalogueCountSchema = z.object({
  domainId: idSchema,
  products: z.number(),
  packages: z.number(),
});

export const platformStatsSchema = z.object({
  professionals: z.number(),
  projects: z.number(),
  cities: z.number(),
  avgRating: z.number(),
});

export const searchSuggestionSchema = z.object({
  label: z.string(),
  hint: z.string(),
  href: z.string(),
});

/* ---------------- customer ---------------- */

/** One person invited, and what became of it. */
export const referralEntrySchema = z.object({
  referral: referralSchema,
  name: z.string(),
});

export const referralSummarySchema = z.object({
  code: z.string(),
  shareUrl: z.string(),
  invited: z.number(),
  earned: z.number(),
  pending: z.number(),
  rewardPerReferral: rupeesSchema,
  referrals: z.array(referralEntrySchema),
});

/** `POST /me/requirements/:id/agreements` answers with the ids it created. */
export const agreementIdsSchema = z.array(idSchema);

/* ---------------- re-exports the manifest reaches for ---------------- */

export {
  agreementSchema,
  meetingSchema,
  messageSchema,
  partnerAgreementSchema,
  portfolioItemSchema,
  projectSchema,
  quoteSchema,
  reviewSchema,
  supportTicketSchema,
  vendorLeadCardSchema,
};
