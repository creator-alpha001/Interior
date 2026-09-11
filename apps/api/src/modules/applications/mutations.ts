/**
 * Applying to become a vendor, and being told yes or no.
 *
 * The whole point of this module is that approving is a single transaction. An
 * approved application has to produce a professional record, its per-trade
 * links, its service areas and a user whose role has moved across — and a
 * partial version of that is the worst outcome available. A professional row
 * with no approved trade is a vendor in no lead pool; a role flipped with no
 * professional row is an account that cannot sign in at all, because
 * `actorFromRow` refuses a professional with nothing behind it.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { ProfessionalApplicationView } from "@repo/types";
import { db, transaction, type Tx } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors";
import { getApplication, myApplication } from "./repository";

/** Statuses that mean ops still have this on their desk. */
const OPEN_STATUSES = ["submitted", "under_review", "changes_requested"] as const;

export interface ApplicationInput {
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

/**
 * Submits an application, or replaces one that came back for changes.
 *
 * A person with an application still open cannot file a second — the partial
 * unique index says so too, and this is the check that turns that into a
 * sentence somebody can read rather than a constraint violation. The one
 * exception is `changes_requested`, which exists precisely to be answered: that
 * row is updated in place, so the reviewer sees one application with a history
 * rather than two competing ones.
 */
export async function submitApplication(
  userId: string,
  input: ApplicationInput,
): Promise<ProfessionalApplicationView> {
  const [user] = await db
    .select()
    .from(t.users)
    .where(and(eq(t.users.id, userId), isNull(t.users.deletedAt)))
    .limit(1);

  if (!user) throw new NotFoundError("That account");

  // Somebody who is already a vendor has nothing to apply for, and an admin
  // applying would be asking to have their own role taken away.
  if (user.role !== "client") {
    throw new ConflictError(
      user.role === "professional"
        ? "This account is already a professional account"
        : "Staff accounts cannot apply as a professional",
    );
  }

  const domainIds = await validDomainIds(input.requestedDomainIds);
  const cityIds = await validCityIds(input.serviceCityIds);

  const existing = await db
    .select()
    .from(t.professionalApplications)
    .where(
      and(
        eq(t.professionalApplications.userId, userId),
        isNull(t.professionalApplications.deletedAt),
        inArray(t.professionalApplications.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1);

  const values = {
    companyName: input.companyName.trim(),
    gstNumber: input.gstNumber?.trim() || null,
    experienceYears: input.experienceYears,
    bio: input.bio.trim(),
    contactName: input.contactName.trim(),
    // Falls back to the number the account already proved, which is the number
    // ops would ring anyway. Null stays null: a Google sign-in may not have one.
    contactMobile: input.contactMobile?.trim() || user.mobile,
    requestedDomainIds: domainIds,
    serviceCityIds: cityIds,
    serviceAreaNote: input.serviceAreaNote?.trim() ?? "",
    updatedAt: new Date().toISOString(),
  };

  const open = existing[0];
  if (open) {
    if (open.status !== "changes_requested") {
      throw new ConflictError("Your application is already with our team");
    }

    await db
      .update(t.professionalApplications)
      .set({
        ...values,
        // Back into the queue, and back to the start of it — the clock restarts
        // because this is a new thing to read, not the old one still waiting.
        status: "submitted",
        submittedAt: new Date().toISOString(),
        // The previous decision is history now. Leaving the note behind would
        // show the applicant "please add your GST number" beside an application
        // that has one.
        reviewerNote: null,
        decidedAt: null,
        decidedByUserId: null,
      })
      .where(eq(t.professionalApplications.id, open.id));

    return getApplication(open.id);
  }

  const [created] = await db
    .insert(t.professionalApplications)
    .values({ ...values, userId, status: "submitted" })
    .returning({ id: t.professionalApplications.id });

  return getApplication(created!.id);
}

/** Withdraws an open application, so somebody can change their mind. */
export async function withdrawApplication(userId: string): Promise<ProfessionalApplicationView | null> {
  await db
    .update(t.professionalApplications)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(t.professionalApplications.userId, userId),
        isNull(t.professionalApplications.deletedAt),
        inArray(t.professionalApplications.status, [...OPEN_STATUSES]),
      ),
    );

  return myApplication(userId);
}

export type Decision =
  | { action: "start_review" }
  | { action: "request_changes"; note: string }
  | { action: "reject"; note: string }
  | {
      action: "approve";
      note?: string;
      /**
       * The trades actually granted, when they are not the ones asked for.
       *
       * Approval is per trade and always was — a fabricator who also applied to
       * paint can be approved for one and not the other, and this is where that
       * decision is expressed. Omitted means "everything they asked for".
       */
      approvedDomainIds?: string[];
      commissionPercentOverrides?: Record<string, number>;
    };

/**
 * The reviewer's decision.
 *
 * Every branch ends with the application in a terminal or waiting state and
 * `decided_by_user_id` set, so "who let this vendor on" is answerable from the
 * row itself rather than from an audit log that may or may not have been
 * written.
 */
export async function decideApplication(
  staffUserId: string,
  applicationId: string,
  decision: Decision,
): Promise<ProfessionalApplicationView> {
  const [row] = await db
    .select()
    .from(t.professionalApplications)
    .where(
      and(
        eq(t.professionalApplications.id, applicationId),
        isNull(t.professionalApplications.deletedAt),
      ),
    )
    .limit(1);

  if (!row) throw new NotFoundError("That application");

  if (row.status === "approved") {
    // Approving twice would create a second professional record for one person,
    // and `uq_professionals_user` would refuse it — but after the role had
    // already been written. Refuse here, where it is still one clean sentence.
    throw new ConflictError("That application has already been approved");
  }

  const now = new Date().toISOString();

  if (decision.action === "start_review") {
    await db
      .update(t.professionalApplications)
      .set({ status: "under_review", updatedAt: now })
      .where(eq(t.professionalApplications.id, applicationId));
    return getApplication(applicationId);
  }

  if (decision.action === "request_changes" || decision.action === "reject") {
    const note = decision.note.trim();
    if (note.length < 10) {
      throw new ValidationError(
        "Say what needs to change. The applicant is shown this, and a refusal with no reason gives them nothing to act on.",
      );
    }

    await db
      .update(t.professionalApplications)
      .set({
        status: decision.action === "reject" ? "rejected" : "changes_requested",
        reviewerNote: note,
        decidedAt: now,
        decidedByUserId: staffUserId,
        updatedAt: now,
      })
      .where(eq(t.professionalApplications.id, applicationId));

    return getApplication(applicationId);
  }

  const granted = decision.approvedDomainIds?.length
    ? decision.approvedDomainIds.filter((id) => row.requestedDomainIds.includes(id))
    : row.requestedDomainIds;

  if (granted.length === 0) {
    throw new ValidationError(
      "Approve at least one trade, or refuse the application. A vendor approved for nothing is in no lead pool and would never hear from us again.",
    );
  }

  await transaction(async (tx) => {
    await approveInto(tx, row, {
      staffUserId,
      grantedDomainIds: granted,
      overrides: decision.commissionPercentOverrides ?? {},
      note: decision.note?.trim() || null,
      now,
    });
  });

  return getApplication(applicationId);
}

/**
 * Everything that has to be true at once for somebody to become a vendor.
 *
 * Kept in one function taking a transaction so there is exactly one place that
 * knows what "a vendor exists" consists of. `verification_status` starts at
 * `pending`. Approval says this person may work here; verification says we hold
 * the signed original of the agreement and the documents behind it, which
 * cannot exist yet — the portal they are sent from opens at this moment. Until
 * then they are in no lead pool, because `eligible_vendors` requires `verified`.
 * See `modules/vendor/verification.ts`.
 */
async function approveInto(
  tx: Tx,
  application: typeof t.professionalApplications.$inferSelect,
  context: {
    staffUserId: string;
    grantedDomainIds: string[];
    overrides: Record<string, number>;
    note: string | null;
    now: string;
  },
): Promise<void> {
  const [professional] = await tx
    .insert(t.professionals)
    .values({
      userId: application.userId,
      companyName: application.companyName,
      gstNumber: application.gstNumber,
      experienceYears: application.experienceYears,
      bio: application.bio,
      verificationStatus: "pending",
    })
    .returning({ id: t.professionals.id });

  const professionalId = professional!.id;

  await tx.insert(t.professionalDomains).values(
    context.grantedDomainIds.map((domainId) => ({
      professionalId,
      domainId,
      verificationStatus: "approved" as const,
      commissionPercentOverride: context.overrides[domainId] ?? null,
    })),
  );

  if (application.serviceCityIds.length > 0) {
    await tx.insert(t.professionalServiceAreas).values(
      application.serviceCityIds.map((cityId) => ({
        professionalId,
        cityId,
        // The free-text note the applicant wrote is guidance for ops, not a
        // machine-readable locality list. Narrowing inside a city is set on the
        // vendor's own profile once they are in.
        localities: [] as string[],
      })),
    );
  }

  /*
   * The role moves across.
   *
   * `Actor` is one role per user, so this is what actually opens the partner
   * portal: `actorFromRow` reads `users.role` and only then looks for the
   * professional row. It takes effect on their next request rather than at some
   * later sign-in, because sessions resolve the role live from this table.
   *
   * Their client row is deliberately left in place. Deleting it would orphan
   * every requirement they raised as a customer, and those records are part of
   * agreements and projects that other people are party to.
   */
  await tx
    .update(t.users)
    .set({ role: "professional", updatedAt: context.now })
    .where(eq(t.users.id, application.userId));

  await tx
    .update(t.professionalApplications)
    .set({
      status: "approved",
      professionalId,
      reviewerNote: context.note,
      decidedAt: context.now,
      decidedByUserId: context.staffUserId,
      updatedAt: context.now,
    })
    .where(eq(t.professionalApplications.id, application.id));
}

/* ------------------------------------------------------------------ *
 * Input that has to exist
 * ------------------------------------------------------------------ */

/**
 * Checks the ids against the tables, rather than trusting the form.
 *
 * The schemas already say these are UUIDs. They cannot say the trade is real
 * and still active, and an application requesting a deleted domain is one that
 * cannot be approved — the insert would fail against the foreign key, at the
 * far end of a review, in front of an admin who did nothing wrong.
 */
async function validDomainIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    throw new ValidationError("Choose at least one trade you want to be approved for");
  }

  const rows = await db
    .select({ id: t.domains.id })
    .from(t.domains)
    .where(and(inArray(t.domains.id, unique), eq(t.domains.isActive, true), isNull(t.domains.deletedAt)));

  if (rows.length !== unique.length) {
    throw new ValidationError("One of those trades is no longer available");
  }
  return unique;
}

async function validCityIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    throw new ValidationError("Choose at least one city you work in");
  }

  const rows = await db
    .select({ id: t.cities.id })
    .from(t.cities)
    .where(and(inArray(t.cities.id, unique), eq(t.cities.isActive, true)));

  if (rows.length !== unique.length) {
    throw new ValidationError("We are not operating in one of those cities yet");
  }
  return unique;
}
