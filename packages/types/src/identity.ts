import type { BaseRecord, ID, Rupees } from "./common";

export type UserRole = "client" | "professional" | "sales_agent" | "admin";
export type UserStatus = "active" | "inactive" | "blocked";

/** One row per person on the platform, whatever their role. */
export interface User extends BaseRecord {
  id: ID;
  name: string;
  mobile: string;
  email: string | null;
  role: UserRole;
  cityId: ID;
  status: UserStatus;
  avatarUrl: string | null;
}

export interface Client extends BaseRecord {
  id: ID;
  userId: ID;
  address: string | null;
  referralCode: string;
  referredByUserId: ID | null;
}

export type VerificationStatus =
  | "pending"
  | "verified"
  | "suspended"
  | "blacklisted";

export interface Professional extends BaseRecord {
  id: ID;
  userId: ID;
  companyName: string;
  gstNumber: string | null;
  experienceYears: number;
  bio: string;
  /** Cached across all domains; per-domain ratings live on ProfessionalDomain. */
  avgRating: number;
  ratingCount: number;
  completedProjects: number;
  languages: string[];
  verificationStatus: VerificationStatus;
  /** Median hours to respond to a new lead. Surfaced on the Performance screen. */
  avgResponseHours: number;
}

export interface SalesAgent extends BaseRecord {
  id: ID;
  userId: ID;
  assignedCityIds: ID[];
  dailyTarget: number;
}

/* ---- Admin access control ---- */

export type PermissionKey =
  | "leads.view" | "leads.manage"
  | "vendors.view" | "vendors.verify"
  | "agreements.view" | "agreements.manage"
  | "commission.view" | "commission.manage"
  | "catalog.manage"
  | "blog.manage"
  | "reports.view"
  | "settings.manage";

export interface AdminRole extends BaseRecord {
  id: ID;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export interface AdminUser extends BaseRecord {
  id: ID;
  userId: ID;
  roleId: ID;
}

export interface AuditLog {
  id: ID;
  actorUserId: ID;
  action: string;
  entityType: string;
  entityId: ID;
  /** Human-readable summary shown in the admin audit trail. */
  summary: string;
  createdAt: string;
}

/** Push notification targets. One row per installed app instance. */
export interface DeviceToken extends BaseRecord {
  id: ID;
  userId: ID;
  token: string;
  platform: "android" | "ios" | "web";
}

export interface Referral extends BaseRecord {
  id: ID;
  referrerUserId: ID;
  referredUserId: ID;
  rewardStatus: "pending" | "earned" | "paid" | "expired";
  rewardAmount: Rupees;
}

/* ---- Who is calling ---- */

export type ActorRole = UserRole;

/**
 * The signed-in caller, narrowed to the ids their role actually has.
 *
 * A union rather than one shape with optional ids: a function needing a client
 * id should not compile against an actor that might be a vendor.
 */
export type Actor =
  | { role: "client"; userId: ID; clientId: ID }
  | { role: "professional"; userId: ID; professionalId: ID }
  | { role: "sales_agent"; userId: ID; salesAgentId: ID }
  | { role: "admin"; userId: ID };

/**
 * The actor plus the bits of them a screen needs to render.
 *
 * Kept separate from `Actor` so authorisation code cannot accidentally branch
 * on a display name: `Actor` answers "may they", this answers "who is it".
 */
export interface SessionUser {
  actor: Actor;
  name: string;
  /** The signed-in person's own number — never another party's. */
  mobile: string;
  avatarUrl: string | null;
}
