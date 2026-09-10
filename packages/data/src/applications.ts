/**
 * Applying to become a vendor, from the apps' side of the seam.
 *
 * Both surfaces of one flow live here on purpose. The customer's "where has my
 * application got to" and the reviewer's "approve this" are the same record
 * seen from two ends, and splitting them across two modules is how the two ends
 * come to disagree about what a status means.
 *
 * As everywhere in this package: with a backend configured these are HTTP
 * calls, and without one they resolve against the seed store so the whole
 * journey can be walked locally with nothing running.
 */
import type {
  ProfessionalApplication,
  ProfessionalApplicationStatus,
  ProfessionalApplicationView,
} from "@repo/types";
import { api } from "./client";
import { callingApiAsUser, currentUserId } from "./session";
import { delay, nextId, nowIso, store } from "./store";

export interface ProfessionalApplicationInput {
  companyName: string;
  gstNumber?: string | null;
  experienceYears: number;
  bio: string;
  contactName: string;
  contactMobile?: string | null;
  requestedDomainIds: string[];
  serviceCityIds: string[];
  serviceAreaNote?: string;
}

export type ApplicationDecision =
  | { action: "start_review" }
  | { action: "request_changes"; note: string }
  | { action: "reject"; note: string }
  | {
      action: "approve";
      note?: string;
      /** Omitted means every trade they asked for. */
      approvedDomainIds?: string[];
      commissionPercentOverrides?: Record<string, number>;
    };

/** Statuses that mean the application is still with our team. */
export const OPEN_APPLICATION_STATUSES: ProfessionalApplicationStatus[] = [
  "submitted",
  "under_review",
  "changes_requested",
];

export function isApplicationOpen(status: ProfessionalApplicationStatus): boolean {
  return OPEN_APPLICATION_STATUSES.includes(status);
}

/* ------------------------------------------------------------------ *
 * The applicant's side
 * ------------------------------------------------------------------ */

/**
 * This person's application, or null if they have never made one.
 *
 * Null is the ordinary answer, not a failure — most customers never apply — so
 * the screens branch on it rather than treating it as an error.
 */
export async function myProfessionalApplication(): Promise<ProfessionalApplicationView | null> {
  if (await callingApiAsUser()) {
    return api<ProfessionalApplicationView | null>("/me/professional-application");
  }

  const userId = await currentUserId();
  const application = latestFor(userId);
  return delay(application ? toView(application) : null);
}

export async function submitProfessionalApplication(
  input: ProfessionalApplicationInput,
): Promise<ProfessionalApplicationView> {
  if (await callingApiAsUser()) {
    return api<ProfessionalApplicationView>("/me/professional-application", {
      method: "POST",
      body: input,
    });
  }

  const userId = await currentUserId();
  const user = store.users.find((u) => u.id === userId);

  if (user?.role === "professional") {
    throw new Error("This account is already a professional account");
  }
  if (input.requestedDomainIds.length === 0) {
    throw new Error("Choose at least one trade you want to be approved for");
  }
  if (input.serviceCityIds.length === 0) {
    throw new Error("Choose at least one city you work in");
  }

  const open = store.professionalApplications.find(
    (a) => a.userId === userId && a.deletedAt === null && isApplicationOpen(a.status),
  );

  if (open && open.status !== "changes_requested") {
    throw new Error("Your application is already with our team");
  }

  const fields = {
    companyName: input.companyName.trim(),
    gstNumber: input.gstNumber?.trim() || null,
    experienceYears: input.experienceYears,
    bio: input.bio.trim(),
    contactName: input.contactName.trim(),
    contactMobile: input.contactMobile?.trim() || user?.mobile || null,
    requestedDomainIds: [...new Set(input.requestedDomainIds)],
    serviceCityIds: [...new Set(input.serviceCityIds)],
    serviceAreaNote: input.serviceAreaNote?.trim() ?? "",
  };

  if (open) {
    // Answering a change request updates the application rather than making a
    // second one, so the reviewer sees one request with a history.
    Object.assign(open, fields, {
      status: "submitted" as const,
      submittedAt: nowIso(),
      reviewerNote: null,
      decidedAt: null,
      decidedByUserId: null,
      updatedAt: nowIso(),
    });
    return delay(toView(open));
  }

  const application: ProfessionalApplication = {
    id: nextId("app"),
    userId,
    ...fields,
    status: "submitted",
    submittedAt: nowIso(),
    decidedAt: null,
    decidedByUserId: null,
    reviewerNote: null,
    professionalId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.professionalApplications.push(application);

  return delay(toView(application));
}

/** Withdraws an open application, so somebody can change their mind. */
export async function withdrawProfessionalApplication(): Promise<ProfessionalApplicationView | null> {
  if (await callingApiAsUser()) {
    return api<ProfessionalApplicationView | null>("/me/professional-application", {
      method: "DELETE",
    });
  }

  const userId = await currentUserId();
  for (const application of store.professionalApplications) {
    if (application.userId === userId && application.deletedAt === null && isApplicationOpen(application.status)) {
      application.deletedAt = nowIso();
      application.updatedAt = nowIso();
    }
  }

  const remaining = latestFor(userId);
  return delay(remaining ? toView(remaining) : null);
}

/* ------------------------------------------------------------------ *
 * The reviewer's side
 * ------------------------------------------------------------------ */

export async function listProfessionalApplications(
  filters: { status?: ProfessionalApplicationStatus | "all" } = {},
): Promise<ProfessionalApplicationView[]> {
  if (await callingApiAsUser()) {
    return api<ProfessionalApplicationView[]>("/ops/professional-applications", {
      query: { status: filters.status },
    });
  }

  const status = filters.status && filters.status !== "all" ? filters.status : undefined;

  return delay(
    store.professionalApplications
      .filter((a) => a.deletedAt === null && (!status || a.status === status))
      // Oldest first: a queue worked by people is only fair worked in order.
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
      .map(toView),
  );
}

export async function getProfessionalApplication(
  id: string,
): Promise<ProfessionalApplicationView | null> {
  if (await callingApiAsUser()) {
    return api<ProfessionalApplicationView>(
      `/ops/professional-applications/${encodeURIComponent(id)}`,
    );
  }

  const application = store.professionalApplications.find(
    (a) => a.id === id && a.deletedAt === null,
  );
  return delay(application ? toView(application) : null);
}

/**
 * Records a decision — and, when it is an approval, creates the vendor.
 *
 * The mock branch below does the same four writes the API's transaction does,
 * because a local walkthrough that approves somebody and leaves them unable to
 * sign in teaches the wrong thing about how this works.
 */
export async function decideProfessionalApplication(
  id: string,
  decision: ApplicationDecision,
): Promise<ProfessionalApplicationView> {
  if (await callingApiAsUser()) {
    return api<ProfessionalApplicationView>(
      `/ops/professional-applications/${encodeURIComponent(id)}/decision`,
      { method: "POST", body: decision },
    );
  }

  const application = store.professionalApplications.find(
    (a) => a.id === id && a.deletedAt === null,
  );
  if (!application) throw new Error("Unknown application");
  if (application.status === "approved") {
    throw new Error("That application has already been approved");
  }

  const staffUserId = "user-admin";

  if (decision.action === "start_review") {
    application.status = "under_review";
    application.updatedAt = nowIso();
    return delay(toView(application));
  }

  if (decision.action === "request_changes" || decision.action === "reject") {
    if (decision.note.trim().length < 10) {
      throw new Error("Say what needs to change — the applicant is shown this");
    }
    application.status = decision.action === "reject" ? "rejected" : "changes_requested";
    application.reviewerNote = decision.note.trim();
    application.decidedAt = nowIso();
    application.decidedByUserId = staffUserId;
    application.updatedAt = nowIso();
    return delay(toView(application));
  }

  const granted = decision.approvedDomainIds?.length
    ? decision.approvedDomainIds.filter((d) => application.requestedDomainIds.includes(d))
    : application.requestedDomainIds;

  if (granted.length === 0) {
    throw new Error("Approve at least one trade, or refuse the application");
  }

  const professionalId = nextId("pro");
  store.professionals.push({
    id: professionalId,
    userId: application.userId,
    companyName: application.companyName,
    gstNumber: application.gstNumber,
    experienceYears: application.experienceYears,
    bio: application.bio,
    avgRating: 0,
    ratingCount: 0,
    completedProjects: 0,
    languages: [],
    verificationStatus: "verified",
    avgResponseHours: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  });

  for (const domainId of granted) {
    store.professionalDomains.push({
      id: nextId("pd"),
      professionalId,
      domainId,
      verificationStatus: "approved",
      commissionPercentOverride: decision.commissionPercentOverrides?.[domainId] ?? null,
      avgRating: 0,
      ratingCount: 0,
      completedProjects: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
  }

  for (const cityId of application.serviceCityIds) {
    store.professionalServiceAreas.push({
      id: nextId("psa"),
      professionalId,
      cityId,
      localities: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
  }

  // The role is what actually opens the partner portal. See the note on the
  // API's `approveInto`, which this mirrors.
  const user = store.users.find((u) => u.id === application.userId);
  if (user) {
    user.role = "professional";
    user.updatedAt = nowIso();
  }

  application.status = "approved";
  application.professionalId = professionalId;
  application.reviewerNote = decision.note?.trim() || null;
  application.decidedAt = nowIso();
  application.decidedByUserId = staffUserId;
  application.updatedAt = nowIso();

  return delay(toView(application));
}

/* ------------------------------------------------------------------ *
 * Seed-store plumbing
 * ------------------------------------------------------------------ */

function latestFor(userId: string): ProfessionalApplication | undefined {
  return store.professionalApplications
    .filter((a) => a.userId === userId && a.deletedAt === null)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
}

function toView(application: ProfessionalApplication): ProfessionalApplicationView {
  const user = store.users.find((u) => u.id === application.userId);
  const client = store.clients.find((c) => c.userId === application.userId);

  return {
    application,
    applicantName: user?.name ?? "Unknown",
    applicantMobile: user?.mobile ?? null,
    applicantEmail: user?.email ?? null,
    requestedDomains: application.requestedDomainIds.flatMap((id) => {
      const domain = store.domains.find((d) => d.id === id);
      return domain ? [domain] : [];
    }),
    serviceCities: application.serviceCityIds.flatMap((id) => {
      const city = store.cities.find((c) => c.id === id);
      return city ? [city] : [];
    }),
    requirementsRaised: client
      ? store.leads.filter((l) => l.clientId === client.id).length
      : 0,
  };
}
