/**
 * Identity: who is on the platform, and who is calling.
 *
 * Every shape here is inferred from `./schema/identity`. The import is
 * `import type`, so zod is erased at build time.
 */
import type { z } from "zod";
import type {
  actorSchema,
  adminRoleSchema,
  adminUserSchema,
  auditLogSchema,
  clientSchema,
  deviceTokenSchema,
  permissionKeySchema,
  professionalApplicationSchema,
  professionalApplicationStatusSchema,
  professionalSchema,
  referralSchema,
  salesAgentSchema,
  sessionUserSchema,
  userRoleSchema,
  userSchema,
  userStatusSchema,
  verificationStatusSchema,
} from "./schema/identity";

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;

/** One row per person on the platform, whatever their role. */
export type User = z.infer<typeof userSchema>;

export type Client = z.infer<typeof clientSchema>;

export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export type Professional = z.infer<typeof professionalSchema>;

export type ProfessionalApplicationStatus = z.infer<typeof professionalApplicationStatusSchema>;

/** A customer's request to become a vendor, before ops have decided. */
export type ProfessionalApplication = z.infer<typeof professionalApplicationSchema>;

export type SalesAgent = z.infer<typeof salesAgentSchema>;

/* ---- Admin access control ---- */

export type PermissionKey = z.infer<typeof permissionKeySchema>;

export type AdminRole = z.infer<typeof adminRoleSchema>;

export type AdminUser = z.infer<typeof adminUserSchema>;

export type AuditLog = z.infer<typeof auditLogSchema>;

/** Push notification targets. One row per installed app instance. */
export type DeviceToken = z.infer<typeof deviceTokenSchema>;

export type Referral = z.infer<typeof referralSchema>;

/* ---- Who is calling ---- */

export type ActorRole = UserRole;

/**
 * The signed-in caller, narrowed to the ids their role actually has.
 *
 * A union rather than one shape with optional ids: a function needing a client
 * id should not compile against an actor that might be a vendor.
 */
export type Actor = z.infer<typeof actorSchema>;

/**
 * The actor plus the bits of them a screen needs to render.
 *
 * Kept separate from `Actor` so authorisation code cannot accidentally branch
 * on a display name: `Actor` answers "may they", this answers "who is it".
 */
export type SessionUser = z.infer<typeof sessionUserSchema>;
