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
