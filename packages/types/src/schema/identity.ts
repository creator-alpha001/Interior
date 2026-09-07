import { z } from "zod";
import { baseRecordSchema, idSchema, rupeesSchema } from "./common";

export const userRoleSchema = z.enum(["client", "professional", "sales_agent", "admin"]);
export const userStatusSchema = z.enum(["active", "inactive", "blocked"]);

/** One row per person on the platform, whatever their role. */
export const userSchema = baseRecordSchema.extend({
  id: idSchema,
  name: z.string(),
  mobile: z.string(),
  email: z.string().nullable(),
  role: userRoleSchema,
  cityId: idSchema,
  status: userStatusSchema,
  avatarUrl: z.string().nullable(),
});

export const clientSchema = baseRecordSchema.extend({
  id: idSchema,
  userId: idSchema,
  address: z.string().nullable(),
  referralCode: z.string(),
  referredByUserId: idSchema.nullable(),
});

export const verificationStatusSchema = z.enum([
  "pending",
  "verified",
  "suspended",
  "blacklisted",
]);

export const professionalSchema = baseRecordSchema.extend({
  id: idSchema,
  userId: idSchema,
  companyName: z.string(),
  gstNumber: z.string().nullable(),
  experienceYears: z.number(),
  bio: z.string(),
  /** Cached across all domains; per-domain ratings live on ProfessionalDomain. */
  avgRating: z.number(),
  ratingCount: z.number().int(),
  completedProjects: z.number().int(),
  languages: z.array(z.string()),
  verificationStatus: verificationStatusSchema,
  /** Median hours to respond to a new lead. Surfaced on the Performance screen. */
  avgResponseHours: z.number(),
});

export const salesAgentSchema = baseRecordSchema.extend({
  id: idSchema,
  userId: idSchema,
  assignedCityIds: z.array(idSchema),
  dailyTarget: z.number().int(),
});

/* ---- Admin access control ---- */

export const permissionKeySchema = z.enum([
  "leads.view", "leads.manage",
  "vendors.view", "vendors.verify",
  "agreements.view", "agreements.manage",
  "commission.view", "commission.manage",
  "catalog.manage",
  "blog.manage",
  "reports.view",
  "settings.manage",
]);

export const adminRoleSchema = baseRecordSchema.extend({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  permissions: z.array(permissionKeySchema),
});

export const adminUserSchema = baseRecordSchema.extend({
  id: idSchema,
  userId: idSchema,
  roleId: idSchema,
});

export const auditLogSchema = z.object({
  id: idSchema,
  actorUserId: idSchema,
  action: z.string(),
  entityType: z.string(),
  entityId: idSchema,
  /** Human-readable summary shown in the admin audit trail. */
  summary: z.string(),
  createdAt: z.string(),
});

/** Push notification targets. One row per installed app instance. */
export const deviceTokenSchema = baseRecordSchema.extend({
  id: idSchema,
  userId: idSchema,
  token: z.string(),
  platform: z.enum(["android", "ios", "web"]),
});

export const referralSchema = baseRecordSchema.extend({
  id: idSchema,
  referrerUserId: idSchema,
  referredUserId: idSchema,
  rewardStatus: z.enum(["pending", "earned", "paid", "expired"]),
  rewardAmount: rupeesSchema,
});

/* ---- Who is calling ---- */

export const actorRoleSchema = userRoleSchema;

/**
 * The signed-in caller, narrowed to the ids their role actually has.
 *
 * A discriminated union rather than one shape with optional ids: a function
 * needing a client id should not compile against an actor that might be a
 * vendor. `z.discriminatedUnion` keeps that property at runtime too — an actor
 * body claiming `role: "client"` without a `clientId` fails to parse.
 */
export const actorSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("client"), userId: idSchema, clientId: idSchema }),
  z.object({ role: z.literal("professional"), userId: idSchema, professionalId: idSchema }),
  z.object({ role: z.literal("sales_agent"), userId: idSchema, salesAgentId: idSchema }),
  z.object({ role: z.literal("admin"), userId: idSchema }),
]);

/**
 * The actor plus the bits of them a screen needs to render.
 *
 * Kept separate from `actorSchema` so authorisation code cannot accidentally
 * branch on a display name: the actor answers "may they", this answers
 * "who is it".
 */
export const sessionUserSchema = z.object({
  actor: actorSchema,
  name: z.string(),
  /** The signed-in person's own number — never another party's. */
  mobile: z.string(),
  avatarUrl: z.string().nullable(),
});
