/**
 * Admin queries and actions: vendor verification, agreements, commission,
 * domain configuration and reporting.
 *
 * Separated from ops.ts because the audience differs — a sales agent works a
 * queue, an admin configures the platform and reconciles money.
 */
import type {
  AgreementView,
  CommissionInvoice,
  Domain,
  DomainApprovalStatus,
  InvoiceStatus,
  Professional,
  ProfessionalDomain,
  ProfessionalSummary,
  Rupees,
  SupportTicket,
  VerificationStatus,
} from "@repo/types";
import { domainById, toAgreementView, toProfessionalSummary } from "./mappers";
import { hasSignedPartnerAgreementSync } from "./onboarding";
import { api } from "./client";
import { callingApiAsUser } from "./session";
import { delay, nextId, nowIso, store } from "./store";

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export interface DomainSlice {
  domain: Domain;
  leads: number;
  quoted: number;
  won: number;
  revenue: Rupees;
  commission: Rupees;
  avgTicket: Rupees;
  conversionPercent: number;
  vendors: number;
}

export interface AdminDashboard {
  totals: {
    leads: number;
    activeLeads: number;
    vendors: number;
    pendingVerification: number;
    revenue: Rupees;
    commissionBilled: Rupees;
    commissionPending: Rupees;
    commissionOverdue: Rupees;
    openTickets: number;
  };
  byDomain: DomainSlice[];
  byCity: Array<{ cityName: string; leads: number; revenue: Rupees }>;
}

/**
 * Domain-wise breakdown is the point of this screen: it tells the business
 * which vertical earns, which converts, and where to put marketing money.
 */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  if (await callingApiAsUser()) return api<AdminDashboard>("/ops/reports");

  const byDomain: DomainSlice[] = store.domains.map((domain) => {
    const leadDomains = store.leadDomains.filter((ld) => ld.domainId === domain.id);
    const projects = store.projects.filter((project) => {
      const ld = store.leadDomains.find((l) => l.id === project.leadDomainId);
      return ld?.domainId === domain.id && project.status !== "cancelled";
    });
    const revenue = projects.reduce((sum, p) => sum + p.value, 0);
    const quoted = leadDomains.filter((ld) =>
      ["quoted", "vendor_selected", "in_progress", "completed"].includes(ld.status),
    ).length;
    const won = leadDomains.filter((ld) =>
      ["vendor_selected", "in_progress", "completed"].includes(ld.status),
    ).length;

    return {
      domain,
      leads: leadDomains.length,
      quoted,
      won,
      revenue,
      commission: projects.reduce((sum, p) => sum + p.commissionAmount, 0),
      avgTicket: projects.length ? Math.round(revenue / projects.length) : 0,
      conversionPercent: leadDomains.length
        ? Math.round((won / leadDomains.length) * 100)
        : 0,
      vendors: store.professionalDomains.filter(
        (pd) => pd.domainId === domain.id && pd.verificationStatus === "approved",
      ).length,
    };
  });

  const byCity = store.cities.map((city) => {
    const leads = store.leads.filter((l) => l.cityId === city.id);
    const revenue = store.projects
      .filter((p) => {
        const ld = store.leadDomains.find((l) => l.id === p.leadDomainId);
        const lead = store.leads.find((l) => l.id === ld?.leadId);
        return lead?.cityId === city.id;
      })
      .reduce((sum, p) => sum + p.value, 0);
    return { cityName: city.name, leads: leads.length, revenue };
  });

  return delay({
    totals: {
      leads: store.leads.length,
      activeLeads: store.leads.filter((l) =>
        ["new", "verified", "in_progress"].includes(l.overallStatus),
      ).length,
      vendors: store.professionals.filter((p) => p.verificationStatus === "verified").length,
      pendingVerification:
        store.professionals.filter((p) => p.verificationStatus === "pending").length +
        store.professionalDomains.filter((pd) => pd.verificationStatus === "pending").length,
      revenue: store.projects
        .filter((p) => p.status !== "cancelled")
        .reduce((sum, p) => sum + p.value, 0),
      commissionBilled: store.commissionInvoices.reduce((sum, i) => sum + i.amount, 0),
      commissionPending: store.commissionInvoices
        .filter((i) => i.status === "pending")
        .reduce((sum, i) => sum + i.amount, 0),
      commissionOverdue: store.commissionInvoices
        .filter((i) => i.status === "overdue")
        .reduce((sum, i) => sum + i.amount, 0),
      openTickets: store.supportTickets.filter((t) =>
        ["open", "in_progress"].includes(t.status),
      ).length,
    },
    byDomain,
    byCity: byCity.sort((a, b) => b.leads - a.leads),
  });
}

/* ------------------------------------------------------------------ *
 * Vendors
 * ------------------------------------------------------------------ */

export interface VendorRow {
  professional: Professional;
  summary: ProfessionalSummary;
  domainLinks: Array<{ link: ProfessionalDomain; domain: Domain }>;
  serviceCities: string[];
  liveJobs: number;
  pendingDomainRequests: number;
  totalRevenue: Rupees;
  outstandingCommission: Rupees;
  /** Unsigned vendors are in no lead pool, however verified they are. */
  hasSignedPartnerAgreement: boolean;
}

export async function listVendors(filters: {
  status?: VerificationStatus | "all";
  domainSlug?: string;
  cityId?: string;
  search?: string;
} = {}): Promise<VendorRow[]> {
  const domain = filters.domainSlug
    ? store.domains.find((d) => d.slug === filters.domainSlug)
    : undefined;
  const search = filters.search?.trim().toLowerCase();

  return delay(
    store.professionals
      .filter((pro) => {
        if (filters.status && filters.status !== "all" && pro.verificationStatus !== filters.status)
          return false;
        if (
          domain &&
          !store.professionalDomains.some(
            (pd) => pd.professionalId === pro.id && pd.domainId === domain.id,
          )
        )
          return false;
        if (
          filters.cityId &&
          !store.professionalServiceAreas.some(
            (a) => a.professionalId === pro.id && a.cityId === filters.cityId,
          )
        )
          return false;
        if (search) {
          const user = store.users.find((u) => u.id === pro.userId);
          if (!`${user?.name ?? ""} ${pro.companyName}`.toLowerCase().includes(search)) return false;
        }
        return true;
      })
      .map((pro) => toVendorRow(pro.id))
      .sort(
        (a, b) =>
          b.pendingDomainRequests - a.pendingDomainRequests ||
          b.summary.avgRating - a.summary.avgRating,
      ),
  );
}

function toVendorRow(professionalId: string): VendorRow {
  const professional = store.professionals.find((p) => p.id === professionalId)!;
  const links = store.professionalDomains.filter((pd) => pd.professionalId === professionalId);
  const projects = store.projects.filter((p) => p.professionalId === professionalId);

  return {
    professional,
    summary: toProfessionalSummary(professionalId),
    domainLinks: links.map((link) => ({ link, domain: domainById(link.domainId) })),
    serviceCities: store.professionalServiceAreas
      .filter((a) => a.professionalId === professionalId)
      .map((a) => store.cities.find((c) => c.id === a.cityId)?.name ?? ""),
    liveJobs: projects.filter((p) => p.status === "ongoing").length,
    pendingDomainRequests: links.filter((l) => l.verificationStatus === "pending").length,
    totalRevenue: projects.reduce((sum, p) => sum + p.value, 0),
    outstandingCommission: store.commissionInvoices
      .filter(
        (i) =>
          i.professionalId === professionalId && ["pending", "overdue"].includes(i.status),
      )
      .reduce((sum, i) => sum + i.amount, 0),
    hasSignedPartnerAgreement: hasSignedPartnerAgreementSync(professionalId),
  };
}

export async function getVendor(professionalId: string): Promise<VendorRow | null> {
  if (await callingApiAsUser()) {
    return api<VendorRow>(`/ops/vendors/${encodeURIComponent(professionalId)}`);
  }

  const exists = store.professionals.some((p) => p.id === professionalId);
  return delay(exists ? toVendorRow(professionalId) : null);
}

export async function setVendorStatus(
  professionalId: string,
  status: VerificationStatus,
): Promise<void> {
  if (await callingApiAsUser()) {
    await api(`/ops/vendors/${encodeURIComponent(professionalId)}`, {
      method: "PATCH",
      body: { status },
    });
    return;
  }

  const pro = store.professionals.find((p) => p.id === professionalId);
  if (!pro) throw new Error("Unknown professional");
  pro.verificationStatus = status;
  pro.updatedAt = nowIso();

  // Suspending the account suspends every trade with it — a vendor under
  // review should stop receiving leads everywhere, not just in one domain.
  if (status === "suspended" || status === "blacklisted") {
    for (const link of store.professionalDomains.filter(
      (pd) => pd.professionalId === professionalId,
    )) {
      link.verificationStatus = "rejected";
      link.updatedAt = nowIso();
    }
  }
  return delay(undefined);
}

/**
 * Approval is per trade. A fabricator asking to take painting work is a
 * separate decision from whether they are a legitimate business.
 */
export async function setVendorDomainStatus(
  professionalId: string,
  domainId: string,
  status: DomainApprovalStatus,
): Promise<void> {
  if (await callingApiAsUser()) {
    await api(
      `/ops/vendors/${encodeURIComponent(professionalId)}/domains/${encodeURIComponent(domainId)}`,
      { method: "PATCH", body: { status } },
    );
    return;
  }

  const link = store.professionalDomains.find(
    (pd) => pd.professionalId === professionalId && pd.domainId === domainId,
  );
  if (link) {
    link.verificationStatus = status;
    link.updatedAt = nowIso();
  } else if (status === "approved") {
    store.professionalDomains.push({
      id: nextId("pd"),
      professionalId,
      domainId,
      verificationStatus: "approved",
      commissionPercentOverride: null,
      avgRating: 0,
      ratingCount: 0,
      completedProjects: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
  }
  return delay(undefined);
}

export async function setCommissionOverride(
  professionalId: string,
  domainId: string,
  percent: number | null,
): Promise<void> {
  if (await callingApiAsUser()) {
    await api(
      `/ops/vendors/${encodeURIComponent(professionalId)}/domains/${encodeURIComponent(domainId)}`,
      { method: "PATCH", body: { commissionPercentOverride: percent } },
    );
    return;
  }

  const link = store.professionalDomains.find(
    (pd) => pd.professionalId === professionalId && pd.domainId === domainId,
  );
  if (link) {
    link.commissionPercentOverride = percent;
    link.updatedAt = nowIso();
  }
  return delay(undefined);
}

/* ------------------------------------------------------------------ *
 * Agreements and commission
 * ------------------------------------------------------------------ */

export async function listAllAgreements(filters: { status?: string; domainSlug?: string } = {}) {
  const domain = filters.domainSlug
    ? store.domains.find((d) => d.slug === filters.domainSlug)
    : undefined;

  return delay(
    store.agreements
      .filter((a) => {
        if (filters.status && filters.status !== "all" && a.status !== filters.status) return false;
        if (domain) {
          const links = store.agreementLeadDomains.filter((l) => l.agreementId === a.id);
          const covers = links.some((l) => {
            const ld = store.leadDomains.find((x) => x.id === l.leadDomainId);
            return ld?.domainId === domain.id;
          });
          if (!covers) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => toAgreementView(a.id)) as AgreementView[],
  );
}

export interface InvoiceRow {
  invoice: CommissionInvoice;
  professional: ProfessionalSummary;
  agreementReference: string;
  domains: string[];
  isCombined: boolean;
  daysOverdue: number;
}

export async function listCommissionInvoices(
  status: InvoiceStatus | "all" = "all",
): Promise<InvoiceRow[]> {
  const today = nowIso().slice(0, 10);

  return delay(
    store.commissionInvoices
      .filter((i) => status === "all" || i.status === status)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((invoice) => {
        const agreement = store.agreements.find((a) => a.id === invoice.agreementId);
        const links = store.agreementLeadDomains.filter(
          (l) => l.agreementId === invoice.agreementId,
        );
        return {
          invoice,
          professional: toProfessionalSummary(invoice.professionalId),
          agreementReference: agreement?.reference ?? "—",
          domains: links.map((l) => {
            const ld = store.leadDomains.find((x) => x.id === l.leadDomainId);
            return ld ? domainById(ld.domainId).name : "";
          }),
          isCombined: links.length > 1,
          daysOverdue:
            invoice.status === "overdue"
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(today).getTime() - new Date(invoice.dueDate).getTime()) / 86_400_000,
                  ),
                )
              : 0,
        };
      }),
  );
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  note?: string,
): Promise<void> {
  if (await callingApiAsUser()) {
    await api(`/ops/invoices/${encodeURIComponent(invoiceId)}`, {
      method: "PATCH",
      body: { status, note },
    });
    return;
  }

  const invoice = store.commissionInvoices.find((i) => i.id === invoiceId);
  if (!invoice) throw new Error("Unknown invoice");
  invoice.status = status;
  if (status === "paid") invoice.paidDate = nowIso().slice(0, 10);
  if (note) invoice.adjustmentNote = note;
  invoice.updatedAt = nowIso();
  return delay(undefined);
}

/* ------------------------------------------------------------------ *
 * Domain configuration — what makes the platform extensible
 * ------------------------------------------------------------------ */

export interface DomainInput {
  name: string;
  tagline: string;
  description: string;
  defaultCommissionPercent: number;
  materialsLabel: string;
  warrantyLabel: string;
  pricingBasis: string;
}

/**
 * Adding a trade is an admin action, not a release. Every downstream module
 * reads domainId, so a new domain is usable across leads, quotes, agreements,
 * projects and reports the moment it is created here.
 */
export async function createDomain(input: DomainInput): Promise<Domain> {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const domain: Domain = {
    id: nextId("dom"),
    name: input.name,
    slug,
    tagline: input.tagline,
    description: input.description,
    iconKey: slug,
    bannerUrl: null,
    defaultCommissionPercent: input.defaultCommissionPercent,
    isActive: true,
    sortOrder: store.domains.length + 1,
    labels: {
      materials: input.materialsLabel,
      warranty: input.warrantyLabel,
      pricingBasis: input.pricingBasis,
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.domains.push(domain);
  return delay(domain);
}

export async function updateDomain(
  domainId: string,
  patch: Partial<DomainInput> & { isActive?: boolean },
): Promise<void> {
  const domain = store.domains.find((d) => d.id === domainId);
  if (!domain) throw new Error("Unknown domain");

  if (patch.name !== undefined) domain.name = patch.name;
  if (patch.tagline !== undefined) domain.tagline = patch.tagline;
  if (patch.description !== undefined) domain.description = patch.description;
  if (patch.defaultCommissionPercent !== undefined)
    domain.defaultCommissionPercent = patch.defaultCommissionPercent;
  if (patch.materialsLabel !== undefined) domain.labels.materials = patch.materialsLabel;
  if (patch.warrantyLabel !== undefined) domain.labels.warranty = patch.warrantyLabel;
  if (patch.pricingBasis !== undefined) domain.labels.pricingBasis = patch.pricingBasis;
  if (patch.isActive !== undefined) domain.isActive = patch.isActive;
  domain.updatedAt = nowIso();
  return delay(undefined);
}

/** What a domain carries with it, so deactivating it is an informed decision. */
export async function getDomainUsage(domainId: string): Promise<{
  vendors: number;
  liveLeads: number;
  products: number;
  packages: number;
  projects: number;
}> {
  if (await callingApiAsUser()) {
    return api(`/ops/domains/${encodeURIComponent(domainId)}/usage`);
  }

  const leadDomainIds = store.leadDomains
    .filter((ld) => ld.domainId === domainId)
    .map((ld) => ld.id);

  return delay({
    vendors: store.professionalDomains.filter(
      (pd) => pd.domainId === domainId && pd.verificationStatus === "approved",
    ).length,
    liveLeads: store.leadDomains.filter(
      (ld) =>
        ld.domainId === domainId && !["completed", "cancelled"].includes(ld.status),
    ).length,
    products: store.products.filter((p) => p.domainId === domainId).length,
    packages: store.servicePackages.filter((p) => p.domainId === domainId).length,
    projects: store.projects.filter((p) => leadDomainIds.includes(p.leadDomainId)).length,
  });
}

/* ------------------------------------------------------------------ *
 * Support
 * ------------------------------------------------------------------ */

export interface AdminTicketRow {
  ticket: SupportTicket;
  raisedByName: string;
  raisedByRole: string;
}

export async function listAllTickets(
  status: SupportTicket["status"] | "all" = "all",
): Promise<AdminTicketRow[]> {
  const weight: Record<SupportTicket["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return delay(
    store.supportTickets
      .filter((t) => status === "all" || t.status === status)
      .sort(
        (a, b) =>
          weight[a.priority] - weight[b.priority] || b.createdAt.localeCompare(a.createdAt),
      )
      .map((ticket) => {
        const user = store.users.find((u) => u.id === ticket.raisedByUserId);
        return {
          ticket,
          raisedByName: user?.name ?? "Unknown",
          raisedByRole: user?.role ?? "client",
        };
      }),
  );
}

export async function replyToTicketAsAdmin(
  ticketId: string,
  authorName: string,
  body: string,
): Promise<void> {
  const ticket = store.supportTickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Unknown ticket");
  ticket.replies.push({
    id: nextId("trep"),
    authorRole: "platform",
    authorName,
    body,
    createdAt: nowIso(),
  });
  if (ticket.status === "open") ticket.status = "in_progress";
  ticket.updatedAt = nowIso();
  return delay(undefined);
}

export async function setTicketStatus(
  ticketId: string,
  status: SupportTicket["status"],
): Promise<void> {
  if (await callingApiAsUser()) {
    await api(`/ops/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      body: { status },
    });
    return;
  }

  const ticket = store.supportTickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Unknown ticket");
  ticket.status = status;
  ticket.updatedAt = nowIso();
  return delay(undefined);
}
