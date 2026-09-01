import type { AdminRole, AdminUser, User } from "@repo/types";
import { rec } from "./helpers";
import { adminUsers, clientUsers, salesUsers } from "./journey";
import { professionalUsers } from "./professionals";

export * from "./helpers";
export * from "./cities";
export * from "./domains";
export * from "./professionals";
export * from "./catalog";
export * from "./blog";
export * from "./partner-terms";
export * from "./journey";

export const adminRoles: AdminRole[] = [
  {
    ...rec(400, 60),
    id: "role-super-admin",
    name: "Super Admin",
    description: "Full access to every module including settings and domain configuration.",
    permissions: [
      "leads.view", "leads.manage",
      "vendors.view", "vendors.verify",
      "agreements.view", "agreements.manage",
      "commission.view", "commission.manage",
      "catalog.manage", "blog.manage", "reports.view", "settings.manage",
    ],
  },
  {
    ...rec(400, 60),
    id: "role-ops",
    name: "Operations Manager",
    description: "Manages leads, vendors and agreements. Cannot change commission rules or platform settings.",
    permissions: [
      "leads.view", "leads.manage",
      "vendors.view", "vendors.verify",
      "agreements.view", "agreements.manage",
      "commission.view", "reports.view",
    ],
  },
  {
    ...rec(400, 60),
    id: "role-content",
    name: "Content & Marketing",
    description: "Manages the catalogue, packages, banners and blog. No access to leads or money.",
    permissions: ["catalog.manage", "blog.manage", "reports.view"],
  },
];

export const adminUserRecords: AdminUser[] = [
  { ...rec(400, 5), id: "admin-neha", userId: "user-admin", roleId: "role-super-admin" },
];

/** Everyone on the platform, in one list — mirrors the single `users` table. */
export const users: User[] = [
  ...clientUsers,
  ...professionalUsers,
  ...salesUsers,
  ...adminUsers,
];
