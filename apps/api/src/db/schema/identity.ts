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
  devicePlatform,
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
    /** E.164 without the plus, e.g. "919919344871". The login identifier. */
    mobile: varchar("mobile", { length: 20 }).notNull(),
    email: text("email"),
    role: userRole("role").notNull(),
    cityId: fk("city_id")
      .notNull()
      .references(() => cities.id),
    status: userStatus("status").notNull().default("active"),
    avatarUrl: text("avatar_url"),
    ...timestamps,
  },
  (t) => [
    // Soft-deleted rows must not stop a returning customer signing up again
    // with the same number, so both uniques are partial.
    uniqueIndex("uq_users_mobile").on(t.mobile).where(sql`${t.deletedAt} IS NULL`),
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

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: primaryId(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: devicePlatform("platform").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("uq_device_token").on(t.token)],
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
