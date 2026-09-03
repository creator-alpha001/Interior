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
  VendorRow,
} from "@repo/types";
import { db, transaction } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors";
import { fromX10, toDomain, toProfessionalSummary } from "../../lib/mappers";
import { decodeCursor, page } from "../../lib/pagination";

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
      .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
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
    .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
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
    city: typeof t.cities.$inferSelect;
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
      .innerJoin(t.cities, eq(t.cities.id, t.users.cityId))
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
}

export async function createDomain(input: DomainInput) {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [maxOrder] = await db
    .select({ value: sql<number>`COALESCE(max(${t.domains.sortOrder}), 0)::int` })
    .from(t.domains);

  const [domain] = await db
    .insert(t.domains)
    .values({
      name: input.name,
      slug,
      tagline: input.tagline,
      description: input.description,
      iconKey: slug,
      defaultCommissionPercent: input.defaultCommissionPercent,
      sortOrder: (maxOrder?.value ?? 0) + 1,
      labels: input.labels,
    })
    .returning();

  return toDomain(domain!);
}

export async function updateDomain(domainId: string, patch: Partial<DomainInput> & { isActive?: boolean }) {
  const rows = await db
    .update(t.domains)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.tagline !== undefined ? { tagline: patch.tagline } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.defaultCommissionPercent !== undefined
        ? { defaultCommissionPercent: patch.defaultCommissionPercent }
        : {}),
      ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
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
      authorName: `${user?.name ?? "Aangan"} (Aangan support)`,
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
