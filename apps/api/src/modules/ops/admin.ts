/**
 * The admin side: vendors, money, domain configuration, support.
 *
 * Separated from the sales module because the permissions differ — an
 * operations manager works leads all day and should not be able to change a
 * commission rate.
 */
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type {
  AdminDashboard,
  AdminTicketRow,
  DomainSlice,
  InvoiceRow,
  Paginated,
  ProductOption,
  VendorRow,
} from "@repo/types";
import { attachMedia, attachSingleImage, replaceOwnedMedia } from "../uploads/repository";
import { db, transaction, type Tx } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors";
import { fromX10, toDomain, toProfessionalSummary } from "../../lib/mappers";
import { decodeCursor, page } from "../../lib/pagination";
import { vendorCityJoin } from "../../lib/vendor-city";

/* ------------------------------------------------------------------ *
 * The business dashboard
 * ------------------------------------------------------------------ */

/**
 * Every figure here is a SQL aggregate.
 *
 * The previous implementation loaded every lead, project and invoice into
 * memory and reduced over them, which is fine at demo scale and impossible at
 * real scale — the point of this screen is to still work when the numbers on it
 * are large.
 */
export async function getDashboard(): Promise<AdminDashboard> {
  const [totals, domainRows, cityRows] = await Promise.all([
    db.execute<Record<string, number>>(sql`
      SELECT
        (SELECT count(*) FROM ${t.leads} WHERE deleted_at IS NULL)::int AS leads,
        (SELECT count(*) FROM ${t.leads}
          WHERE deleted_at IS NULL
            AND overall_status IN ('new', 'verified', 'in_progress'))::int AS active_leads,
        (SELECT count(*) FROM ${t.professionals} WHERE deleted_at IS NULL)::int AS vendors,
        (SELECT count(*) FROM ${t.professionals}
          WHERE deleted_at IS NULL AND verification_status = 'pending')::int AS pending_verification,
        (SELECT COALESCE(sum(value), 0) FROM ${t.projects} WHERE deleted_at IS NULL)::bigint AS revenue,
        (SELECT COALESCE(sum(amount), 0) FROM ${t.commissionInvoices})::bigint AS commission_billed,
        (SELECT COALESCE(sum(amount), 0) FROM ${t.commissionInvoices}
          WHERE status = 'pending')::bigint AS commission_pending,
        (SELECT COALESCE(sum(amount), 0) FROM ${t.commissionInvoices}
          WHERE status = 'overdue')::bigint AS commission_overdue,
        (SELECT count(*) FROM ${t.supportTickets}
          WHERE status IN ('open', 'in_progress'))::int AS open_tickets
    `),
    db.execute<Record<string, unknown>>(sql`
      SELECT
        d.id AS domain_id,
        count(DISTINCT ld.id)::int AS leads,
        count(DISTINCT ld.id) FILTER (WHERE ld.status <> 'pending_assignment' AND ld.status <> 'assigned')::int AS quoted,
        count(DISTINCT ld.id) FILTER (WHERE ld.selected_professional_id IS NOT NULL)::int AS won,
        COALESCE(sum(p.value), 0)::bigint AS revenue,
        COALESCE(sum(p.commission_amount), 0)::bigint AS commission,
        (SELECT count(*) FROM ${t.professionalDomains} pd
          WHERE pd.domain_id = d.id AND pd.verification_status = 'approved')::int AS vendors
      FROM ${t.domains} d
      LEFT JOIN ${t.leadDomains} ld ON ld.domain_id = d.id AND ld.deleted_at IS NULL
      LEFT JOIN ${t.projects} p ON p.lead_domain_id = ld.id AND p.deleted_at IS NULL
      WHERE d.deleted_at IS NULL
      GROUP BY d.id
      ORDER BY d.sort_order
    `),
    db.execute<Record<string, unknown>>(sql`
      SELECT c.name AS city_name,
             count(DISTINCT l.id)::int AS leads,
             COALESCE(sum(p.value), 0)::bigint AS revenue
      FROM ${t.cities} c
      LEFT JOIN ${t.leads} l ON l.city_id = c.id AND l.deleted_at IS NULL
      LEFT JOIN ${t.leadDomains} ld ON ld.lead_id = l.id
      LEFT JOIN ${t.projects} p ON p.lead_domain_id = ld.id
      GROUP BY c.id, c.name
      HAVING count(DISTINCT l.id) > 0
      ORDER BY count(DISTINCT l.id) DESC
    `),
  ]);

  const domains = await db.select().from(t.domains).where(isNull(t.domains.deletedAt));
  const byId = new Map(domains.map((d) => [d.id, d]));
  const total = (totals as unknown as Array<Record<string, unknown>>)[0] ?? {};

  return {
    totals: {
      leads: Number(total.leads ?? 0),
      activeLeads: Number(total.active_leads ?? 0),
      vendors: Number(total.vendors ?? 0),
      pendingVerification: Number(total.pending_verification ?? 0),
      revenue: Number(total.revenue ?? 0),
      commissionBilled: Number(total.commission_billed ?? 0),
      commissionPending: Number(total.commission_pending ?? 0),
      commissionOverdue: Number(total.commission_overdue ?? 0),
      openTickets: Number(total.open_tickets ?? 0),
    },
    byDomain: (domainRows as unknown as Array<Record<string, unknown>>)
      .map((row): DomainSlice | null => {
        const domain = byId.get(String(row.domain_id));
        if (!domain) return null;
        const leads = Number(row.leads ?? 0);
        const won = Number(row.won ?? 0);
        const revenue = Number(row.revenue ?? 0);
        return {
          domain: toDomain(domain),
          leads,
          quoted: Number(row.quoted ?? 0),
          won,
          revenue,
          commission: Number(row.commission ?? 0),
          avgTicket: won === 0 ? 0 : Math.round(revenue / won),
          conversionPercent: leads === 0 ? 0 : Math.round((won / leads) * 100),
          vendors: Number(row.vendors ?? 0),
        };
      })
      .filter((slice): slice is DomainSlice => slice !== null),
    byCity: (cityRows as unknown as Array<Record<string, unknown>>).map((row) => ({
      cityName: String(row.city_name),
      leads: Number(row.leads ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Vendors
 * ------------------------------------------------------------------ */

export interface VendorFilters {
  status?: string;
  domain?: string;
  city?: string;
  search?: string;
  limit: number;
  cursor?: string;
}

export async function listVendors(filters: VendorFilters): Promise<Paginated<VendorRow>> {
  const offset = decodeCursor(filters.cursor);
  const conditions = [isNull(t.professionals.deletedAt)];

  if (filters.status && filters.status !== "all") {
    conditions.push(
      eq(t.professionals.verificationStatus, filters.status as "pending" | "verified" | "suspended" | "blacklisted"),
    );
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${t.professionals.companyName}) LIKE ${term} OR lower(${t.users.name}) LIKE ${term})`,
    );
  }
  if (filters.domain) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${t.professionalDomains} pd
      JOIN ${t.domains} d ON d.id = pd.domain_id
      WHERE pd.professional_id = ${t.professionals.id} AND d.slug = ${filters.domain}
    )`);
  }
  if (filters.city) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${t.professionalServiceAreas} sa
      WHERE sa.professional_id = ${t.professionals.id} AND sa.city_id = ${filters.city}
    )`);
  }

  const where = and(...conditions);

  const [rows, [totals]] = await Promise.all([
    db
      .select({ professional: t.professionals, user: t.users, city: t.cities })
      .from(t.professionals)
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .leftJoin(t.cities, vendorCityJoin)
      .where(where)
      // Anything waiting on us first, then by rating.
      .orderBy(desc(t.professionals.avgRatingX10), asc(t.professionals.id))
      .limit(filters.limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(t.professionals)
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .where(where),
  ]);

  const items = await decorateVendors(rows);
  return page(items, totals?.value ?? 0, offset, filters.limit);
}

export async function getVendor(professionalId: string): Promise<VendorRow> {
  const rows = await db
    .select({ professional: t.professionals, user: t.users, city: t.cities })
    .from(t.professionals)
    .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
    .leftJoin(t.cities, vendorCityJoin)
    .where(eq(t.professionals.id, professionalId))
    .limit(1);

  const [row] = await decorateVendors(rows);
  if (!row) throw new NotFoundError("That professional");
  return row;
}

async function decorateVendors(
  rows: Array<{
    professional: typeof t.professionals.$inferSelect;
    user: typeof t.users.$inferSelect;
    /** Null when neither a service area nor the account says where they are. */
    city: typeof t.cities.$inferSelect | null;
  }>,
): Promise<VendorRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.professional.id);

  const [links, areas, jobs, money, signed] = await Promise.all([
    db
      .select({ link: t.professionalDomains, domain: t.domains })
      .from(t.professionalDomains)
      .innerJoin(t.domains, eq(t.domains.id, t.professionalDomains.domainId))
      .where(inArray(t.professionalDomains.professionalId, ids)),
    db
      .select({ professionalId: t.professionalServiceAreas.professionalId, name: t.cities.name })
      .from(t.professionalServiceAreas)
      .innerJoin(t.cities, eq(t.cities.id, t.professionalServiceAreas.cityId))
      .where(inArray(t.professionalServiceAreas.professionalId, ids)),
    db
      .select({
        professionalId: t.projects.professionalId,
        live: sql<number>`count(*) FILTER (WHERE ${t.projects.status} = 'ongoing')::int`,
        revenue: sql<number>`COALESCE(sum(${t.projects.value}), 0)::bigint`,
      })
      .from(t.projects)
      .where(inArray(t.projects.professionalId, ids))
      .groupBy(t.projects.professionalId),
    db
      .select({
        professionalId: t.commissionInvoices.professionalId,
        outstanding: sql<number>`COALESCE(sum(${t.commissionInvoices.amount}), 0)::bigint`,
      })
      .from(t.commissionInvoices)
      .where(
        and(
          inArray(t.commissionInvoices.professionalId, ids),
          inArray(t.commissionInvoices.status, ["pending", "overdue"]),
        ),
      )
      .groupBy(t.commissionInvoices.professionalId),
    db.execute<{ professional_id: string }>(sql`
      SELECT DISTINCT pa.professional_id
      FROM ${t.partnerAgreements} pa
      WHERE pa.professional_id = ANY(${sql.param(ids)}::uuid[])
        AND pa.status = 'signed'
        AND pa.terms_version = (SELECT version FROM ${t.partnerTerms} WHERE is_current)
    `),
  ]);

  const signedIds = new Set(
    (signed as unknown as Array<{ professional_id: string }>).map((r) => r.professional_id),
  );

  return rows.map((row) => {
    const id = row.professional.id;
    const mine = links.filter((l) => l.link.professionalId === id);
    const job = jobs.find((j) => j.professionalId === id);

    return {
      professional: {
        ...row.professional,
        avgRating: fromX10(row.professional.avgRatingX10),
      } as unknown as VendorRow["professional"],
      summary: toProfessionalSummary({
        professional: row.professional,
        user: row.user,
        city: row.city,
        domains: mine.filter((l) => l.link.verificationStatus === "approved").map((l) => l.domain),
      }),
      domainLinks: mine.map((l) => ({
        link: {
          ...l.link,
          avgRating: fromX10(l.link.avgRatingX10),
        } as unknown as VendorRow["domainLinks"][number]["link"],
        domain: toDomain(l.domain),
      })),
      serviceCities: areas.filter((a) => a.professionalId === id).map((a) => a.name),
      liveJobs: Number(job?.live ?? 0),
      pendingDomainRequests: mine.filter((l) => l.link.verificationStatus === "pending").length,
      totalRevenue: Number(job?.revenue ?? 0),
      outstandingCommission: Number(
        money.find((m) => m.professionalId === id)?.outstanding ?? 0,
      ),
      hasSignedPartnerAgreement: signedIds.has(id),
    };
  });
}

/**
 * Suspending or reinstating a vendor.
 *
 * Suspension no longer rejects every trade approval. It used to, and that was
 * irreversible — reinstating somebody left them approved for nothing, with no
 * record of what they had been approved for. Eligibility already depends on the
 * professional's own status, so suspending is enough on its own.
 */
export async function setVendorStatus(
  professionalId: string,
  status: (typeof t.professionals.$inferSelect)["verificationStatus"],
): Promise<void> {
  return transaction(async (tx) => {
    const rows = await tx
      .update(t.professionals)
      .set({ verificationStatus: status, updatedAt: new Date().toISOString() })
      .where(eq(t.professionals.id, professionalId))
      .returning({ userId: t.professionals.userId });

    if (rows.length === 0) throw new NotFoundError("That professional");

    // A suspended vendor must lose the portal immediately, not at the next
    // token expiry — they can still see live customer jobs in it.
    if (status === "suspended" || status === "blacklisted") {
      await tx
        .update(t.sessions)
        .set({ revokedAt: new Date().toISOString() })
        .where(and(eq(t.sessions.userId, rows[0]!.userId), isNull(t.sessions.revokedAt)));
    }
  });
}

export async function setVendorDomainStatus(
  professionalId: string,
  domainId: string,
  status: (typeof t.professionalDomains.$inferSelect)["verificationStatus"],
): Promise<void> {
  const existing = await db
    .select({ id: t.professionalDomains.id })
    .from(t.professionalDomains)
    .where(
      and(
        eq(t.professionalDomains.professionalId, professionalId),
        eq(t.professionalDomains.domainId, domainId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(t.professionalDomains)
      .set({ verificationStatus: status, updatedAt: new Date().toISOString() })
      .where(eq(t.professionalDomains.id, existing[0]!.id));
    return;
  }

  if (status !== "approved") {
    throw new ConflictError("That professional has not applied for this trade");
  }

  await db.insert(t.professionalDomains).values({ professionalId, domainId, verificationStatus: "approved" });
}

export async function setCommissionOverride(
  professionalId: string,
  domainId: string,
  percent: number | null,
): Promise<void> {
  const rows = await db
    .update(t.professionalDomains)
    .set({ commissionPercentOverride: percent, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(t.professionalDomains.professionalId, professionalId),
        eq(t.professionalDomains.domainId, domainId),
      ),
    )
    .returning({ id: t.professionalDomains.id });

  if (rows.length === 0) throw new NotFoundError("That trade approval");
  // Existing projects keep the rate frozen at signing; this affects new ones.
}

/* ------------------------------------------------------------------ *
 * Commission
 * ------------------------------------------------------------------ */

export async function listInvoices(status: string, limit: number, cursor?: string) {
  const offset = decodeCursor(cursor);
  const where =
    status && status !== "all"
      ? eq(t.commissionInvoices.status, status as "pending" | "paid" | "overdue" | "waived" | "cancelled")
      : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        invoice: t.commissionInvoices,
        agreementReference: t.agreements.reference,
        professional: t.professionals,
        user: t.users,
        city: t.cities,
      })
      .from(t.commissionInvoices)
      .innerJoin(t.agreements, eq(t.agreements.id, t.commissionInvoices.agreementId))
      .innerJoin(t.professionals, eq(t.professionals.id, t.commissionInvoices.professionalId))
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .leftJoin(t.cities, vendorCityJoin)
      .where(where)
      .orderBy(asc(t.commissionInvoices.dueDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.commissionInvoices).where(where),
  ]);

  if (rows.length === 0) return page<InvoiceRow>([], totals?.value ?? 0, offset, limit);

  const lines = await db
    .select({ agreementId: t.agreementLeadDomains.agreementId, name: t.domains.name })
    .from(t.agreementLeadDomains)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.agreementLeadDomains.leadDomainId))
    .innerJoin(t.domains, eq(t.domains.id, t.leadDomains.domainId))
    .where(
      inArray(
        t.agreementLeadDomains.agreementId,
        rows.map((r) => r.invoice.agreementId),
      ),
    );

  const today = Date.now();

  const items = rows.map((row): InvoiceRow => {
    const domains = lines
      .filter((l) => l.agreementId === row.invoice.agreementId)
      .map((l) => l.name);

    return {
      invoice: row.invoice as unknown as InvoiceRow["invoice"],
      professional: toProfessionalSummary({
        professional: row.professional,
        user: row.user,
        city: row.city,
        domains: [],
      }),
      agreementReference: row.agreementReference,
      domains,
      // One invoice covering several services means one vendor was hired for
      // more than one trade on the same requirement.
      isCombined: domains.length > 1,
      daysOverdue:
        row.invoice.status === "overdue"
          ? Math.max(0, Math.floor((today - new Date(row.invoice.dueDate).getTime()) / 86_400_000))
          : 0,
    };
  });

  return page(items, totals?.value ?? 0, offset, limit);
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: (typeof t.commissionInvoices.$inferSelect)["status"],
  note?: string | null,
): Promise<void> {
  if ((status === "waived" || status === "cancelled") && !note?.trim()) {
    // Writing off money is exactly the decision that needs a reason attached.
    throw new ValidationError("A reason is required to waive or cancel an invoice");
  }

  const rows = await db
    .update(t.commissionInvoices)
    .set({
      status,
      paidDate: status === "paid" ? new Date().toISOString().slice(0, 10) : null,
      adjustmentNote: note ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(t.commissionInvoices.id, invoiceId))
    .returning({ id: t.commissionInvoices.id });

  if (rows.length === 0) throw new NotFoundError("That invoice");
}

/* ------------------------------------------------------------------ *
 * Domains
 * ------------------------------------------------------------------ */

export async function listAllDomains() {
  const rows = await db
    .select()
    .from(t.domains)
    .where(isNull(t.domains.deletedAt))
    .orderBy(asc(t.domains.sortOrder));
  return rows.map(toDomain);
}

export interface DomainInput {
  name: string;
  tagline: string;
  description: string;
  defaultCommissionPercent: number;
  labels: { materials: string; warranty: string; pricingBasis: string };
  /** Id of an uploaded `catalogue_image`. Null clears it; undefined leaves it. */
  bannerMediaId?: string | null;
  iconKey?: string;
}

export async function createDomain(input: DomainInput, staffUserId?: string) {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [maxOrder] = await db
    .select({ value: sql<number>`COALESCE(max(${t.domains.sortOrder}), 0)::int` })
    .from(t.domains);

  return transaction(async (tx) => {
    const [domain] = await tx
      .insert(t.domains)
      .values({
        name: input.name,
        slug,
        tagline: input.tagline,
        description: input.description,
        iconKey: input.iconKey ?? slug,
        defaultCommissionPercent: input.defaultCommissionPercent,
        sortOrder: (maxOrder?.value ?? 0) + 1,
        labels: input.labels,
      })
      .returning();

    // After the insert, because the asset is owned by a row that has to exist
    // before it can own anything.
    const bannerUrl = await attachSingleImage(
      tx,
      input.bannerMediaId,
      "domain",
      domain!.id,
      staffUserId,
    );

    if (bannerUrl !== undefined) {
      const [withBanner] = await tx
        .update(t.domains)
        .set({ bannerUrl })
        .where(eq(t.domains.id, domain!.id))
        .returning();
      return toDomain(withBanner!);
    }

    return toDomain(domain!);
  });
}

export async function updateDomain(
  domainId: string,
  patch: Partial<DomainInput> & { isActive?: boolean },
  staffUserId?: string,
) {
  return transaction(async (tx) => {
    const bannerUrl = await attachSingleImage(
      tx,
      patch.bannerMediaId,
      "domain",
      domainId,
      staffUserId,
    );
    return updateDomainRow(tx, domainId, patch, bannerUrl);
  });
}

async function updateDomainRow(
  tx: Tx,
  domainId: string,
  patch: Partial<DomainInput> & { isActive?: boolean },
  bannerUrl: string | null | undefined,
) {
  const rows = await tx
    .update(t.domains)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.tagline !== undefined ? { tagline: patch.tagline } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.defaultCommissionPercent !== undefined
        ? { defaultCommissionPercent: patch.defaultCommissionPercent }
        : {}),
      ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
      // `undefined` is the only value that means "leave it alone"; null is a
      // deliberate clear, which is a thing somebody will want to do.
      ...(bannerUrl !== undefined ? { bannerUrl } : {}),
      ...(patch.iconKey !== undefined ? { iconKey: patch.iconKey } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(t.domains.id, domainId))
    .returning();

  if (rows.length === 0) throw new NotFoundError("That service");
  return toDomain(rows[0]!);
}

/**
 * What deactivating a trade would affect.
 *
 * Advisory rather than enforced: the business may have a good reason to close a
 * vertical with work still running, and the alternative is a rule that stops
 * them doing it at all.
 */
export async function getDomainUsage(domainId: string) {
  const [row] = await db.execute<Record<string, number>>(sql`
    SELECT
      (SELECT count(*) FROM ${t.professionalDomains}
        WHERE domain_id = ${domainId} AND verification_status = 'approved')::int AS vendors,
      (SELECT count(*) FROM ${t.leadDomains}
        WHERE domain_id = ${domainId}
          AND status NOT IN ('completed', 'cancelled'))::int AS live_leads,
      (SELECT count(*) FROM ${t.products} WHERE domain_id = ${domainId} AND is_active)::int AS products,
      (SELECT count(*) FROM ${t.servicePackages} WHERE domain_id = ${domainId} AND is_active)::int AS packages,
      (SELECT count(*) FROM ${t.projects} p
        JOIN ${t.leadDomains} ld ON ld.id = p.lead_domain_id
        WHERE ld.domain_id = ${domainId} AND p.status = 'ongoing')::int AS live_projects
  `);

  const r = (row as unknown as Record<string, number>) ?? {};
  return {
    vendors: Number(r.vendors ?? 0),
    liveLeads: Number(r.live_leads ?? 0),
    products: Number(r.products ?? 0),
    packages: Number(r.packages ?? 0),
    projects: Number(r.live_projects ?? 0),
  };
}

/* ------------------------------------------------------------------ *
 * Support
 * ------------------------------------------------------------------ */

export async function listTickets(status: string, limit: number, cursor?: string) {
  const offset = decodeCursor(cursor);
  const where =
    status && status !== "all"
      ? eq(t.supportTickets.status, status as "open" | "in_progress" | "resolved" | "closed")
      : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({ ticket: t.supportTickets, raisedByName: t.users.name, raisedByRole: t.users.role })
      .from(t.supportTickets)
      .innerJoin(t.users, eq(t.users.id, t.supportTickets.raisedByUserId))
      .where(where)
      // Urgent first, then oldest — a complaint that has waited three days
      // outranks one raised this morning at the same priority.
      .orderBy(
        sql`CASE ${t.supportTickets.priority}
              WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
        asc(t.supportTickets.createdAt),
      )
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.supportTickets).where(where),
  ]);

  if (rows.length === 0) return page<AdminTicketRow>([], totals?.value ?? 0, offset, limit);

  const replies = await db
    .select()
    .from(t.ticketReplies)
    .where(
      inArray(
        t.ticketReplies.ticketId,
        rows.map((r) => r.ticket.id),
      ),
    )
    .orderBy(asc(t.ticketReplies.createdAt));

  const items = rows.map(
    (row): AdminTicketRow => ({
      ticket: {
        ...row.ticket,
        replies: replies
          .filter((r) => r.ticketId === row.ticket.id)
          .map((r) => ({
            id: r.id,
            authorRole: r.authorRole,
            authorName: r.authorName,
            body: r.body,
            createdAt: r.createdAt,
          })),
      } as unknown as AdminTicketRow["ticket"],
      raisedByName: row.raisedByName,
      raisedByRole: row.raisedByRole,
    }),
  );

  return page(items, totals?.value ?? 0, offset, limit);
}

export async function replyToTicket(userId: string, ticketId: string, body: string) {
  const [ticket] = await db
    .select({ id: t.supportTickets.id, status: t.supportTickets.status })
    .from(t.supportTickets)
    .where(eq(t.supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new NotFoundError("That ticket");

  const [user] = await db
    .select({ name: t.users.name })
    .from(t.users)
    .where(eq(t.users.id, userId))
    .limit(1);

  const [reply] = await db
    .insert(t.ticketReplies)
    .values({
      ticketId,
      authorRole: "platform",
      authorUserId: userId,
      // From the session, not the request body — the previous implementation
      // took a display name from the caller.
      authorName: `${user?.name ?? "Decora Shine"} (Decora Shine support)`,
      body,
    })
    .returning();

  if (ticket.status === "open") {
    await db
      .update(t.supportTickets)
      .set({ status: "in_progress", updatedAt: new Date().toISOString() })
      .where(eq(t.supportTickets.id, ticketId));
  }

  return reply!;
}

export async function setTicketStatus(
  ticketId: string,
  status: (typeof t.supportTickets.$inferSelect)["status"],
): Promise<void> {
  const rows = await db
    .update(t.supportTickets)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(t.supportTickets.id, ticketId))
    .returning({ id: t.supportTickets.id });

  if (rows.length === 0) throw new NotFoundError("That ticket");
}

export async function listAllAgreements(limit: number, cursor?: string) {
  const offset = decodeCursor(cursor);

  const [rows, [totals]] = await Promise.all([
    db
      .select({ id: t.agreements.id })
      .from(t.agreements)
      .where(isNull(t.agreements.deletedAt))
      .orderBy(desc(t.agreements.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.agreements).where(isNull(t.agreements.deletedAt)),
  ]);

  const { buildAgreementViews } = await import("../customer/views");
  const items = await buildAgreementViews(rows.map((r) => r.id));
  return page(items, totals?.value ?? 0, offset, limit);
}

/* ------------------------------------------------------------------ *
 * The catalogue
 *
 * Nothing here existed. Trades could be created and edited; the products,
 * packages and categories customers actually browse could only be seeded, so
 * every change to the shop front was a database migration and a deploy.
 *
 * Three things are true of all of it and are worth saying once:
 *
 *   **Slugs are derived from the name and never change afterwards.** They are
 *   in URLs customers bookmark and search engines index, so a rename edits the
 *   heading and leaves the address alone.
 *
 *   **Nothing is hard-deleted.** `isActive: false` takes an item off the shop
 *   front and leaves every lead, quote and agreement that referenced it intact.
 *   A DELETE endpoint would break records that describe work already done.
 *
 *   **Images are attached by asset id inside the same transaction as the row.**
 *   A picture uploaded but never bound to an owner is what the orphan sweep
 *   deletes, so binding it anywhere but here means it disappears a day later.
 * ------------------------------------------------------------------ */

/**
 * A URL-safe slug, unique across the table it is going into.
 *
 * The suffix loop matters more than it looks: "Modular Kitchen" is a plausible
 * name in more than one trade, and the slug indexes are unique across the whole
 * table rather than per domain. Without this the second one fails on a
 * constraint and the person filling in the form is told nothing useful.
 */
async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "item";

  let candidate = root;
  for (let suffix = 2; await exists(candidate); suffix += 1) {
    candidate = `${root}-${suffix}`;
    if (suffix > 50) throw new ConflictError("Could not find a free web address for that name");
  }
  return candidate;
}

/* ---- categories ---- */

export interface CategoryInput {
  domainId: string;
  name: string;
  description: string;
  imageMediaId?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export async function listCategoriesForOps(domainId?: string) {
  return db
    .select({
      category: t.productCategories,
      domain: t.domains,
      products: sql<number>`(
        SELECT count(*) FROM ${t.products}
        WHERE ${t.products.categoryId} = ${t.productCategories.id} AND ${t.products.isActive}
      )::int`,
    })
    .from(t.productCategories)
    .innerJoin(t.domains, eq(t.domains.id, t.productCategories.domainId))
    .where(domainId ? eq(t.productCategories.domainId, domainId) : undefined)
    .orderBy(asc(t.domains.sortOrder), asc(t.productCategories.sortOrder));
}

export async function createCategory(input: CategoryInput, staffUserId?: string) {
  const slug = await uniqueSlug(input.name, async (candidate) => {
    const [row] = await db
      .select({ id: t.productCategories.id })
      .from(t.productCategories)
      .where(eq(t.productCategories.slug, candidate))
      .limit(1);
    return Boolean(row);
  });

  const [maxOrder] = await db
    .select({ value: sql<number>`COALESCE(max(${t.productCategories.sortOrder}), 0)::int` })
    .from(t.productCategories)
    .where(eq(t.productCategories.domainId, input.domainId));

  return transaction(async (tx) => {
    const [row] = await tx
      .insert(t.productCategories)
      .values({
        domainId: input.domainId,
        parentId: input.parentId ?? null,
        name: input.name,
        slug,
        description: input.description,
        sortOrder: input.sortOrder ?? (maxOrder?.value ?? 0) + 1,
      })
      .returning();

    const imageUrl = await attachSingleImage(
      tx,
      input.imageMediaId,
      "product_category",
      row!.id,
      staffUserId,
    );

    if (imageUrl === undefined) return row!;

    const [withImage] = await tx
      .update(t.productCategories)
      .set({ imageUrl })
      .where(eq(t.productCategories.id, row!.id))
      .returning();
    return withImage!;
  });
}

export async function updateCategory(
  categoryId: string,
  patch: Partial<CategoryInput> & { isActive?: boolean },
  staffUserId?: string,
) {
  return transaction(async (tx) => {
    const imageUrl = await attachSingleImage(
      tx,
      patch.imageMediaId,
      "product_category",
      categoryId,
      staffUserId,
    );
    return updateCategoryRow(tx, categoryId, patch, imageUrl);
  });
}

async function updateCategoryRow(
  tx: Tx,
  categoryId: string,
  patch: Partial<CategoryInput> & { isActive?: boolean },
  imageUrl: string | null | undefined,
) {
  const rows = await tx
    .update(t.productCategories)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(patch.parentId !== undefined ? { parentId: patch.parentId ?? null } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(t.productCategories.id, categoryId))
    .returning();

  if (rows.length === 0) throw new NotFoundError("That category");
  return rows[0]!;
}

/* ---- packages ---- */

export interface PackageInput {
  domainId: string;
  name: string;
  shortDescription: string;
  description: string;
  price: number;
  priceBasis: string;
  durationDays: number;
  inclusions: string[];
  exclusions: string[];
  badge?: string | null;
  isFeatured: boolean;
  mediaIds: string[];
}

export async function listPackagesForOps(domainId?: string) {
  return db
    .select({
      servicePackage: t.servicePackages,
      domain: t.domains,
      images: sql<number>`(
        SELECT count(*) FROM ${t.mediaAssets}
        WHERE ${t.mediaAssets.ownerType} = 'service_package'
          AND ${t.mediaAssets.ownerId} = ${t.servicePackages.id}
          AND ${t.mediaAssets.deletedAt} IS NULL
      )::int`,
    })
    .from(t.servicePackages)
    .innerJoin(t.domains, eq(t.domains.id, t.servicePackages.domainId))
    .where(domainId ? eq(t.servicePackages.domainId, domainId) : undefined)
    .orderBy(asc(t.domains.sortOrder), asc(t.servicePackages.name));
}

export async function createPackage(input: PackageInput, staffUserId: string) {
  const slug = await uniqueSlug(input.name, async (candidate) => {
    const [row] = await db
      .select({ id: t.servicePackages.id })
      .from(t.servicePackages)
      .where(eq(t.servicePackages.slug, candidate))
      .limit(1);
    return Boolean(row);
  });

  return transaction(async (tx) => {
    const [row] = await tx
      .insert(t.servicePackages)
      .values({
        domainId: input.domainId,
        name: input.name,
        slug,
        shortDescription: input.shortDescription,
        description: input.description,
        price: input.price,
        priceBasis: input.priceBasis,
        durationDays: input.durationDays,
        inclusions: input.inclusions,
        exclusions: input.exclusions,
        badge: input.badge ?? null,
        isFeatured: input.isFeatured,
      })
      .returning();

    await attachMedia(tx, input.mediaIds, "service_package", row!.id, "catalogue_image", staffUserId);
    return row!;
  });
}

export async function updatePackage(
  packageId: string,
  patch: Partial<PackageInput> & { isActive?: boolean },
  staffUserId: string,
) {
  return transaction(async (tx) => {
    const rows = await tx
      .update(t.servicePackages)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.shortDescription !== undefined ? { shortDescription: patch.shortDescription } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.price !== undefined ? { price: patch.price } : {}),
        ...(patch.priceBasis !== undefined ? { priceBasis: patch.priceBasis } : {}),
        ...(patch.durationDays !== undefined ? { durationDays: patch.durationDays } : {}),
        ...(patch.inclusions !== undefined ? { inclusions: patch.inclusions } : {}),
        ...(patch.exclusions !== undefined ? { exclusions: patch.exclusions } : {}),
        ...(patch.badge !== undefined ? { badge: patch.badge ?? null } : {}),
        ...(patch.isFeatured !== undefined ? { isFeatured: patch.isFeatured } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        // The slug is deliberately absent. It is in URLs customers have
        // bookmarked and search engines have indexed, so a rename changes the
        // heading and leaves the address alone.
        updatedAt: new Date().toISOString(),
      })
      .where(eq(t.servicePackages.id, packageId))
      .returning();

    if (rows.length === 0) throw new NotFoundError("That package");

    if (patch.mediaIds !== undefined) {
      await replaceOwnedMedia(tx, "service_package", packageId, patch.mediaIds, staffUserId);
    }
    return rows[0]!;
  });
}

/* ---- products ---- */

export interface ProductInput {
  domainId: string;
  categoryId: string;
  name: string;
  shortDescription: string;
  description: string;
  basePrice: number;
  priceUnit: "per_piece" | "per_sqft" | "per_running_ft" | "per_kg" | "per_room" | "per_project";
  leadTimeDays: number;
  isCustomisable: boolean;
  specs: Record<string, string>;
  options: ProductOption[];
  tags: string[];
  isFeatured: boolean;
  mediaIds: string[];
}

export async function listProductsForOps(domainId?: string, categoryId?: string) {
  const filters = [
    domainId ? eq(t.products.domainId, domainId) : undefined,
    categoryId ? eq(t.products.categoryId, categoryId) : undefined,
  ].filter(Boolean);

  return db
    .select({
      product: t.products,
      domain: t.domains,
      category: t.productCategories,
      images: sql<number>`(
        SELECT count(*) FROM ${t.mediaAssets}
        WHERE ${t.mediaAssets.ownerType} = 'product'
          AND ${t.mediaAssets.ownerId} = ${t.products.id}
          AND ${t.mediaAssets.deletedAt} IS NULL
      )::int`,
    })
    .from(t.products)
    .innerJoin(t.domains, eq(t.domains.id, t.products.domainId))
    .innerJoin(t.productCategories, eq(t.productCategories.id, t.products.categoryId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(t.domains.sortOrder), asc(t.products.name));
}

export async function createProduct(input: ProductInput, staffUserId: string) {
  /**
   * The category has to belong to the trade.
   *
   * Both are chosen in the same form, so this is only reachable from a stale
   * page or a direct call. But they are independent foreign keys and nothing in
   * the schema stops a painting product being filed under a furniture shelf: it
   * would then list under the wrong trade and read as a bug in the catalogue
   * rather than as a bad write.
   */
  const [category] = await db
    .select({ domainId: t.productCategories.domainId })
    .from(t.productCategories)
    .where(eq(t.productCategories.id, input.categoryId))
    .limit(1);

  if (!category) throw new NotFoundError("That category");
  if (category.domainId !== input.domainId) {
    throw new ValidationError("That category belongs to a different service");
  }

  const slug = await uniqueSlug(input.name, async (candidate) => {
    const [row] = await db
      .select({ id: t.products.id })
      .from(t.products)
      .where(eq(t.products.slug, candidate))
      .limit(1);
    return Boolean(row);
  });

  return transaction(async (tx) => {
    const [row] = await tx
      .insert(t.products)
      .values({
        domainId: input.domainId,
        categoryId: input.categoryId,
        name: input.name,
        slug,
        shortDescription: input.shortDescription,
        description: input.description,
        basePrice: input.basePrice,
        priceUnit: input.priceUnit,
        leadTimeDays: input.leadTimeDays,
        isCustomisable: input.isCustomisable,
        specs: input.specs,
        options: input.options,
        tags: input.tags,
        isFeatured: input.isFeatured,
      })
      .returning();

    await attachMedia(tx, input.mediaIds, "product", row!.id, "catalogue_image", staffUserId);
    return row!;
  });
}

export async function updateProduct(
  productId: string,
  patch: Partial<ProductInput> & { isActive?: boolean },
  staffUserId: string,
) {
  return transaction(async (tx) => {
    const rows = await tx
      .update(t.products)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
        ...(patch.shortDescription !== undefined ? { shortDescription: patch.shortDescription } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.basePrice !== undefined ? { basePrice: patch.basePrice } : {}),
        ...(patch.priceUnit !== undefined ? { priceUnit: patch.priceUnit } : {}),
        ...(patch.leadTimeDays !== undefined ? { leadTimeDays: patch.leadTimeDays } : {}),
        ...(patch.isCustomisable !== undefined ? { isCustomisable: patch.isCustomisable } : {}),
        ...(patch.specs !== undefined ? { specs: patch.specs } : {}),
        ...(patch.options !== undefined ? { options: patch.options } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.isFeatured !== undefined ? { isFeatured: patch.isFeatured } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(t.products.id, productId))
      .returning();

    if (rows.length === 0) throw new NotFoundError("That product");

    if (patch.mediaIds !== undefined) {
      await replaceOwnedMedia(tx, "product", productId, patch.mediaIds, staffUserId);
    }
    return rows[0]!;
  });
}
