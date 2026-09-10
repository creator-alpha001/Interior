/**
 * Reading applications to become a vendor.
 *
 * Two audiences read these rows and they are not the same read. An applicant
 * asks "what is happening with mine", and the session decides which row that
 * is — no endpoint takes an application id from a customer. A reviewer asks for
 * the queue, and may open any of them.
 *
 * Both get the same view model, because the applicant's status screen and the
 * admin panel show the same facts about the same request, and two shapes would
 * mean two joins to keep in step.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { ProfessionalApplicationStatus, ProfessionalApplicationView } from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { NotFoundError } from "../../lib/errors";

/** The columns a view needs, joined to the account behind the application. */
const applicationColumns = {
  application: t.professionalApplications,
  applicantName: t.users.name,
  applicantMobile: t.users.mobile,
  applicantEmail: t.users.email,
} as const;

type ApplicationRow = {
  application: typeof t.professionalApplications.$inferSelect;
  applicantName: string;
  applicantMobile: string | null;
  applicantEmail: string | null;
};

/**
 * Fills in the names behind the stored ids, for a whole page of rows at once.
 *
 * One query for every domain mentioned and one for every city, rather than a
 * pair per application. The queue is the screen that would suffer: twenty
 * applications is forty round trips done the obvious way, and it is the sort of
 * thing that is invisible until the table has a few hundred rows in it.
 */
async function toViews(rows: ApplicationRow[]): Promise<ProfessionalApplicationView[]> {
  if (rows.length === 0) return [];

  const domainIds = [...new Set(rows.flatMap((r) => r.application.requestedDomainIds))];
  const cityIds = [...new Set(rows.flatMap((r) => r.application.serviceCityIds))];
  const userIds = [...new Set(rows.map((r) => r.application.userId))];

  const [domains, cities, requirementCounts] = await Promise.all([
    domainIds.length > 0
      ? db.select().from(t.domains).where(inArray(t.domains.id, domainIds))
      : Promise.resolve([]),
    cityIds.length > 0
      ? db.select().from(t.cities).where(inArray(t.cities.id, cityIds))
      : Promise.resolve([]),
    db
      .select({ userId: t.clients.userId, n: sql<number>`count(${t.leads.id})::int` })
      .from(t.clients)
      .leftJoin(t.leads, eq(t.leads.clientId, t.clients.id))
      .where(inArray(t.clients.userId, userIds))
      .groupBy(t.clients.userId),
  ]);

  const domainById = new Map(domains.map((d) => [d.id, d]));
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const raisedByUser = new Map(requirementCounts.map((r) => [r.userId, r.n]));

  return rows.map((row) => ({
    application: mapApplication(row.application),
    applicantName: row.applicantName,
    applicantMobile: row.applicantMobile,
    applicantEmail: row.applicantEmail,
    /*
     * `flatMap` rather than `map`, so an id that no longer resolves drops out
     * instead of putting `undefined` in an array the screens iterate over. A
     * trade can be deleted between an application arriving and being read.
     */
    requestedDomains: row.application.requestedDomainIds.flatMap((id) => {
      const domain = domainById.get(id);
      return domain ? [domain] : [];
    }),
    serviceCities: row.application.serviceCityIds.flatMap((id) => {
      const city = cityById.get(id);
      return city ? [city] : [];
    }),
    requirementsRaised: raisedByUser.get(row.application.userId) ?? 0,
  }));
}

/** The stored row, as @repo/types describes it. */
function mapApplication(row: typeof t.professionalApplications.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    companyName: row.companyName,
    gstNumber: row.gstNumber,
    experienceYears: row.experienceYears,
    bio: row.bio,
    contactName: row.contactName,
    contactMobile: row.contactMobile,
    requestedDomainIds: row.requestedDomainIds,
    serviceCityIds: row.serviceCityIds,
    serviceAreaNote: row.serviceAreaNote,
    status: row.status,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt,
    decidedByUserId: row.decidedByUserId,
    reviewerNote: row.reviewerNote,
    professionalId: row.professionalId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/**
 * This person's application, if they have ever made one.
 *
 * The most recent, not the open one: somebody refused last month and not yet
 * reapplying still needs to be shown why, and the screen that says "you were
 * refused, here is what to change" is the same screen as "we are looking at
 * this". Null means they have never applied.
 */
export async function myApplication(userId: string): Promise<ProfessionalApplicationView | null> {
  const [row] = await db
    .select(applicationColumns)
    .from(t.professionalApplications)
    .innerJoin(t.users, eq(t.users.id, t.professionalApplications.userId))
    .where(
      and(
        eq(t.professionalApplications.userId, userId),
        isNull(t.professionalApplications.deletedAt),
      ),
    )
    .orderBy(desc(t.professionalApplications.submittedAt))
    .limit(1);

  const [view] = await toViews(row ? [row] : []);
  return view ?? null;
}

/**
 * The reviewer's queue.
 *
 * Oldest waiting first within a status, because a queue worked by people is
 * only fair if it is worked in order — and because the applicant is looking at
 * a screen that says we are considering it.
 */
export async function listApplications(filters: {
  status?: ProfessionalApplicationStatus | "all";
} = {}): Promise<ProfessionalApplicationView[]> {
  const status = filters.status && filters.status !== "all" ? filters.status : undefined;

  const rows = await db
    .select(applicationColumns)
    .from(t.professionalApplications)
    .innerJoin(t.users, eq(t.users.id, t.professionalApplications.userId))
    .where(
      and(
        isNull(t.professionalApplications.deletedAt),
        status ? eq(t.professionalApplications.status, status) : undefined,
      ),
    )
    .orderBy(t.professionalApplications.submittedAt);

  return toViews(rows);
}

export async function getApplication(id: string): Promise<ProfessionalApplicationView> {
  const [row] = await db
    .select(applicationColumns)
    .from(t.professionalApplications)
    .innerJoin(t.users, eq(t.users.id, t.professionalApplications.userId))
    .where(and(eq(t.professionalApplications.id, id), isNull(t.professionalApplications.deletedAt)))
    .limit(1);

  if (!row) throw new NotFoundError("That application");
  const [view] = await toViews([row]);
  return view!;
}
