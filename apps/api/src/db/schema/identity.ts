/**
 * People, and how they prove who they are.
 *
 * `users` is one row per person whatever their role; `clients`, `professionals`
 * and `sales_agents` hang off it. That mirrors @repo/types/identity.ts and is
 * what lets a vendor also be a customer without a duplicate account.
 */
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { cities } from "./geo";
import {
  authProvider,
  devicePlatform,
  professionalApplicationStatus,
  referralRewardStatus,
  userRole,
  userStatus,
  verificationStatus,
} from "./enums";

export const users = pgTable(
  "users",
  {
    id: primaryId(),
    name: text("name").notNull(),
    /**
     * E.164 without the plus, e.g. "919919344871". A login identifier, not the
     * only one, and not a condition of having an account.
     *
     * Nullable since a person can sign in with Google and decline to give a
     * number. Ops still need one before a lead can be worked, but that is a
     * property of the lead and is asked for there — holding signup hostage to
     * it only ever lost the signup.
     */
    mobile: varchar("mobile", { length: 20 }),
    /** When the number was last proved by a code. See the note on `users` below. */
    mobileVerifiedAt: ts("mobile_verified_at"),
    email: text("email"),
    role: userRole("role").notNull(),
    /**
     * Where they are, or null when they have not said.
     *
     * Null is a real answer and must not be replaced by a guess: prices,
     * professionals and availability are all per city, so defaulting somebody
     * into the wrong one shows them a catalogue that does not apply to them and
     * never mentions it. Readers treat null as "every city".
     */
    cityId: fk("city_id").references(() => cities.id),
    status: userStatus("status").notNull().default("active"),
    avatarUrl: text("avatar_url"),
    ...timestamps,
  },
  (t) => [
    // Soft-deleted rows must not stop a returning customer signing up again
    // with the same number, so both uniques are partial. Accounts with no
    // number are excluded too — "no number" is not a number two of them share.
    uniqueIndex("uq_users_mobile")
      .on(t.mobile)
      .where(sql`${t.deletedAt} IS NULL AND ${t.mobile} IS NOT NULL`),
    uniqueIndex("uq_users_email")
      .on(t.email)
      .where(sql`${t.deletedAt} IS NULL AND ${t.email} IS NOT NULL`),
    index("ix_users_role").on(t.role),
  ],
);

export const clients = pgTable(
  "clients",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id),
    address: text("address"),
    referralCode: varchar("referral_code", { length: 24 }).notNull(),
    referredByUserId: fk("referred_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_clients_user").on(t.userId),
    uniqueIndex("uq_clients_referral_code").on(t.referralCode),
  ],
);

export const professionals = pgTable(
  "professionals",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id),
    companyName: text("company_name").notNull(),
    gstNumber: varchar("gst_number", { length: 20 }),
    experienceYears: integer("experience_years").notNull().default(0),
    bio: text("bio").notNull().default(""),
    /**
     * Rating caches over `reviews`, written by the same transaction that writes
     * a review. Denormalised because every listing sorts by them.
     *
     * Stored times ten as an integer: 4.5 is `45`. Ratings are compared and
     * summed constantly and a float that cannot represent 4.1 exactly would
     * make two equal vendors sort unstably.
     */
    avgRatingX10: integer("avg_rating_x10").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    completedProjects: integer("completed_projects").notNull().default(0),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    verificationStatus: verificationStatus("verification_status").notNull().default("pending"),
    avgResponseHours: integer("avg_response_hours").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_professionals_user").on(t.userId),
    index("ix_professionals_verification").on(t.verificationStatus),
  ],
);

/**
 * A customer asking to become a vendor.
 *
 * Nothing here creates a professional; approving one does. Until then this is
 * the only record that the request exists, which is what lets the applicant be
 * shown "we are looking at this" and lets ops refuse without leaving a
 * half-made vendor behind.
 *
 * There is no unique index on `user_id`. A rejected application must be able to
 * be replaced by a better one, and the history of both is worth keeping — the
 * partial index below enforces the rule that actually matters: one *open*
 * application per person at a time.
 */
export const professionalApplications = pgTable(
  "professional_applications",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id),
    companyName: text("company_name").notNull(),
    gstNumber: varchar("gst_number", { length: 20 }),
    experienceYears: integer("experience_years").notNull().default(0),
    bio: text("bio").notNull().default(""),
    contactName: text("contact_name").notNull(),
    contactMobile: varchar("contact_mobile", { length: 20 }),
    /** Read and written whole, never queried into. See the note in @repo/types. */
    requestedDomainIds: jsonb("requested_domain_ids").$type<string[]>().notNull().default([]),
    serviceCityIds: jsonb("service_city_ids").$type<string[]>().notNull().default([]),
    serviceAreaNote: text("service_area_note").notNull().default(""),
    status: professionalApplicationStatus("status").notNull().default("submitted"),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
    decidedAt: ts("decided_at"),
    decidedByUserId: fk("decided_by_user_id").references(() => users.id),
    /** Written for the applicant to read. Required on a refusal. */
    reviewerNote: text("reviewer_note"),
    /** Set on approval, pointing at the vendor record this became. */
    professionalId: fk("professional_id").references(() => professionals.id),
    ...timestamps,
  },
  (t) => [
    index("ix_professional_applications_status").on(t.status, t.submittedAt),
    index("ix_professional_applications_user").on(t.userId),
  ],
);

export const salesAgents = pgTable(
  "sales_agents",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id),
    assignedCityIds: jsonb("assigned_city_ids").$type<string[]>().notNull().default([]),
    dailyTarget: integer("daily_target").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_sales_agents_user").on(t.userId)],
);

export const adminRoles = pgTable("admin_roles", {
  id: primaryId(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** PermissionKey[] from @repo/types, checked in code rather than by the database. */
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  ...timestamps,
});

export const adminUsers = pgTable(
  "admin_users",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id),
    roleId: fk("role_id")
      .notNull()
      .references(() => adminRoles.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_admin_users_user").on(t.userId)],
);

/* ------------------------------------------------------------------ *
 * Authentication
 * ------------------------------------------------------------------ */

/**
 * Server-side sessions rather than JWTs.
 *
 * Revocation has to be immediate — suspending a vendor mid-session must log
 * them out — and a stateless token cannot do that without a denylist, which is
 * a session table wearing a disguise.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 45 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_sessions_token").on(t.tokenHash),
    index("ix_sessions_user").on(t.userId),
    index("ix_sessions_expiry").on(t.expiresAt),
  ],
);

/**
 * One in-flight OTP.
 *
 * The code is stored as an argon2 hash: a leaked backup must not hand somebody
 * a working login for every number that signed in that hour.
 */
export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: primaryId(),
    mobile: varchar("mobile", { length: 20 }).notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    ip: varchar("ip", { length: 45 }),
    ...timestamps,
  },
  (t) => [
    index("ix_otp_mobile_created").on(t.mobile, t.createdAt),
    index("ix_otp_expiry").on(t.expiresAt),
  ],
);

/**
 * A sign-in that is not a mobile number.
 *
 * Its own table rather than a `google_id` column on `users`, because one person
 * may hold several and the interesting queries are "who is this subject" and
 * "what can this account sign in with" — both awkward against a widening row of
 * nullable provider columns.
 *
 * `subject` is the provider's own immutable id for the person, never the email.
 * A Google account's address can change, and two people can hold the same
 * address years apart; the subject cannot and does not.
 *
 * A row here is a complete way in on its own. It used to be half of one: a
 * first Google sign-in still had to verify a mobile number before the account
 * existed, because `users.mobile` was NOT NULL. That cost the signup of anyone
 * unwilling to hand over a phone number to a site they were still evaluating,
 * to buy a number ops would have confirmed on the call anyway.
 */
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProvider("provider").notNull(),
    /** The provider's immutable subject claim (`sub`), not an email address. */
    subject: text("subject").notNull(),
    /**
     * What the provider said the address was when the link was made.
     *
     * Kept for support ("which Google account was this?") and never for
     * lookups: matching on it is how one person ends up signed into another
     * person's account after an address is recycled.
     */
    email: text("email"),
    lastUsedAt: ts("last_used_at"),
    ...timestamps,
  },
  (t) => [
    // One subject belongs to one account. The unique index is what stops a
    // second row quietly granting a second person the same sign-in.
    uniqueIndex("uq_auth_identities_provider_subject").on(t.provider, t.subject),
    index("ix_auth_identities_user").on(t.userId),
  ],
);

/**
 * Staff sign in with a password and a TOTP code, never an SMS.
 *
 * Ops accounts see customer phone numbers, vendor margins and commission
 * figures. They should not be reachable by whoever ends up with a recycled
 * mobile number.
 */
export const staffCredentials = pgTable(
  "staff_credentials",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    /** Base32 TOTP secret, encrypted at rest by the application. */
    totpSecret: text("totp_secret"),
    totpConfirmedAt: ts("totp_confirmed_at"),
    failedAttempts: smallint("failed_attempts").notNull().default(0),
    lockedUntil: ts("locked_until"),
    passwordChangedAt: ts("password_changed_at").notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_staff_credentials_user").on(t.userId)],
);

/**
 * Rate limiting, in the database rather than in memory.
 *
 * The API will run more than one instance eventually, and an in-process counter
 * gives an attacker one allowance per instance. Keyed like
 * "otp:mobile:919919344871" or "otp:ip:1.2.3.4".
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 200 }).primaryKey(),
    count: integer("count").notNull().default(0),
    windowStartedAt: ts("window_started_at").notNull().defaultNow(),
  },
  (t) => [index("ix_rate_limits_window").on(t.windowStartedAt)],
);

/* ------------------------------------------------------------------ *
 * Trail and reach
 * ------------------------------------------------------------------ */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: primaryId(),
    actorUserId: fk("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary").notNull(),
    /** Before and after for the fields that changed, for disputes. */
    changes: jsonb("changes").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 45 }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ix_audit_entity").on(t.entityType, t.entityId),
    index("ix_audit_actor").on(t.actorUserId, t.createdAt),
  ],
);

/**
 * Where a push notification goes.
 *
 * One row per signed-in installation. The token belongs to the *session* as
 * well as the user, which is what makes sign-out able to remove exactly this
 * handset rather than every device the person owns — and what stops the next
 * person to hold a recycled phone receiving somebody else's leads.
 *
 * `failureCount` and `disabledAt` are how a token that the provider keeps
 * rejecting stops being retried forever. Firebase answers `UNREGISTERED` for an
 * app that has been uninstalled, and without this the dispatcher would ask
 * again every two minutes for as long as the row exists.
 */
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Null for rows written before sessions were tracked, and after a revoke. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    token: text("token").notNull(),
    platform: devicePlatform("platform").notNull(),
    /** The build talking to us, for reading a crash report against a version. */
    appVersion: text("app_version"),
    lastSeenAt: ts("last_seen_at"),
    failureCount: integer("failure_count").notNull().default(0),
    /** Set when the provider says the token is dead. Excluded from every send. */
    disabledAt: ts("disabled_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_device_token").on(t.token),
    index("ix_device_user").on(t.userId),
    index("ix_device_session").on(t.sessionId),
  ],
);

export const referrals = pgTable(
  "referrals",
  {
    id: primaryId(),
    referrerUserId: fk("referrer_user_id")
      .notNull()
      .references(() => users.id),
    referredUserId: fk("referred_user_id")
      .notNull()
      .references(() => users.id),
    rewardStatus: referralRewardStatus("reward_status").notNull().default("pending"),
    rewardAmount: integer("reward_amount").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    // Somebody can only be referred once, however many links they click.
    uniqueIndex("uq_referral_referred").on(t.referredUserId),
    index("ix_referral_referrer").on(t.referrerUserId),
  ],
);

/* ---- relations, for Drizzle's query API ---- */

export const usersRelations = relations(users, ({ one }) => ({
  city: one(cities, { fields: [users.cityId], references: [cities.id] }),
  client: one(clients, { fields: [users.id], references: [clients.userId] }),
  professional: one(professionals, { fields: [users.id], references: [professionals.userId] }),
}));

export const clientsRelations = relations(clients, ({ one }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
}));

export const professionalsRelations = relations(professionals, ({ one }) => ({
  user: one(users, { fields: [professionals.userId], references: [users.id] }),
}));
