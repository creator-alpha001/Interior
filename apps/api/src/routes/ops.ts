/**
 * The ops panel.
 *
 * Every handler names the permission it needs as its first line, so what a role
 * can reach is readable from this file alone rather than inferred from what
 * happens to fail.
 */
import type { FastifyInstance } from "fastify";
import { routes } from "@repo/contract";
import { recordStaffMutation } from "../lib/audit";
import { requirePermission } from "../lib/permissions";
import * as ops from "../modules/ops/repository";
import * as write from "../modules/ops/mutations";
import * as admin from "../modules/ops/admin";
import { getOnboarding } from "../modules/vendor/onboarding";
import * as applications from "../modules/applications/repository";
import * as applicationWrite from "../modules/applications/mutations";
import * as verification from "../modules/vendor/verification";
import * as attention from "../modules/ops/attention";
import * as showcase from "../modules/vendor/showcase";

export async function registerOpsRoutes(app: FastifyInstance) {
  /**
   * Nothing under /ops may be cached. These responses carry customer phone
   * numbers, vendor margins and commission figures.
   */
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/ops/")) {
      reply.header("Cache-Control", "no-store, private");
    }
  });

  /**
   * Every staff change is recorded, by a hook rather than by a call in each
   * handler — a trail that depends on somebody remembering has holes in it,
   * and the holes are in the routes added last.
   *
   * `onResponse` so the status code is known: only changes that actually
   * happened are recorded.
   */
  app.addHook("onResponse", async (request, reply) => {
    await recordStaffMutation(request, reply);
  });

  /* ---------------- the queue ---------------- */

  app.get(routes.opsLeads.path, async (request) => {
    await requirePermission(request, "leads.view");
    return ops.listLeads(routes.opsLeads.query!.parse(request.query));
  });

  app.get<{ Params: { id: string } }>(routes.opsLead.path, async (request) => {
    await requirePermission(request, "leads.view");
    const { id } = routes.opsLead.params!.parse(request.params);
    return ops.getLead(id);
  });

  app.get<{ Params: { id: string } }>(routes.opsTimeline.path, async (request) => {
    await requirePermission(request, "leads.view");
    const { id } = routes.opsTimeline.params!.parse(request.params);
    return ops.getTimeline(id);
  });

  app.get<{ Params: { id: string } }>(routes.opsLeadProjects.path, async (request) => {
    await requirePermission(request, "leads.view");
    const { id } = routes.opsLeadProjects.params!.parse(request.params);
    return ops.getLeadProjects(id);
  });

  app.get<{ Params: { id: string } }>(routes.opsCallLog.path, async (request) => {
    await requirePermission(request, "leads.view");
    const { id } = routes.opsCallLog.params!.parse(request.params);
    return ops.listCallLog(id);
  });

  app.post<{ Params: { id: string } }>(routes.opsLogCall.path, async (request, reply) => {
    await requirePermission(request, "leads.manage");
    const { id } = routes.opsLogCall.params!.parse(request.params);
    const input = routes.opsLogCall.body!.parse(request.body);
    reply.status(201);
    return write.logCall(await staffActor(request), { ...input, leadId: id });
  });

  /* ---------------- one service ---------------- */

  app.get<{ Params: { id: string } }>(routes.opsRelay.path, async (request) => {
    await requirePermission(request, "leads.view");
    const { id } = routes.opsRelay.params!.parse(request.params);
    return ops.getRelay(id);
  });

  app.post<{ Params: { id: string } }>(routes.opsReplyToClient.path, async (request, reply) => {
    await requirePermission(request, "leads.manage");
    const { id } = routes.opsReplyToClient.params!.parse(request.params);
    const { body, sourceMessageId } = routes.opsReplyToClient.body!.parse(request.body);
    reply.status(201);
    return write.replyToClient((await staffActor(request)).userId, id, body, sourceMessageId);
  });

  app.post<{ Params: { id: string } }>(routes.opsRelayToVendors.path, async (request, reply) => {
    await requirePermission(request, "leads.manage");
    const { id } = routes.opsRelayToVendors.params!.parse(request.params);
    const { body, sourceMessageId } = routes.opsRelayToVendors.body!.parse(request.body);
    reply.status(201);
    return write.relayToVendors((await staffActor(request)).userId, id, body, sourceMessageId);
  });

  app.get<{ Params: { id: string } }>(routes.opsVendorPool.path, async (request) => {
    await requirePermission(request, "leads.view");
    const { id } = routes.opsVendorPool.params!.parse(request.params);
    return ops.getVendorPool(id);
  });

  app.post<{ Params: { id: string } }>(routes.opsAssign.path, async (request) => {
    await requirePermission(request, "leads.manage");
    const { id } = routes.opsAssign.params!.parse(request.params);
    const { professionalIds } = routes.opsAssign.body!.parse(request.body);
    await write.assignProfessionals(id, professionalIds);
    return ops.getVendorPool(id);
  });

  app.post<{ Params: { id: string } }>(routes.opsScheduleVisit.path, async (request, reply) => {
    await requirePermission(request, "leads.manage");
    const { id } = routes.opsScheduleVisit.params!.parse(request.params);
    const input = routes.opsScheduleVisit.body!.parse(request.body);
    reply.status(201);
    return write.scheduleVisit((await staffActor(request)).salesAgentId, { ...input, leadDomainId: id });
  });

  app.post<{ Params: { id: string } }>(routes.opsVisitOutcome.path, async (request) => {
    await requirePermission(request, "leads.manage");
    const { id } = routes.opsVisitOutcome.params!.parse(request.params);
    const { outcome, changedScope } = routes.opsVisitOutcome.body!.parse(request.body);
    await write.recordVisitOutcome(id, outcome, changedScope);
    return { ok: true };
  });

  app.get(routes.opsVisits.path, async (request) => {
    await requirePermission(request, "leads.view");
    return ops.listVisits();
  });

  /* ---------------- execution ---------------- */

  app.post<{ Params: { id: string; stageId: string } }>(
    routes.opsReviewProof.path,
    async (request) => {
      const userId = await requirePermission(request, "leads.manage");
      const { id, stageId } = routes.opsReviewProof.params!.parse(request.params);
      const { approve, note } = routes.opsReviewProof.body!.parse(request.body);
      await write.reviewMilestoneProof(userId, id, stageId, approve, note ?? null);
      return ops.getLeadProjects(await leadIdForProject(id));
    },
  );

  /* ---------------- day and dashboards ---------------- */

  /**
   * My Day and the sales dashboard are one agent's own screens. An admin has no
   * queue of their own, so they see everything — which is what somebody
   * covering the team actually wants.
   */
  app.get(routes.opsMyDay.path, async (request) => {
    await requirePermission(request, "leads.view");
    return ops.getMyDay((await staffActor(request)).salesAgentId);
  });

  app.get(routes.opsAttention.path, async (request) => {
    await requirePermission(request, "leads.view");
    return attention.getAttention();
  });

  app.get(routes.opsSalesDashboard.path, async (request) => {
    await requirePermission(request, "leads.view");
    return ops.getSalesDashboard((await staffActor(request)).salesAgentId);
  });

  app.get(routes.opsAdminDashboard.path, async (request) => {
    await requirePermission(request, "reports.view");
    return admin.getDashboard();
  });

  app.get(routes.opsAgents.path, async (request) => {
    await requirePermission(request, "leads.view");
    return ops.listSalesAgents();
  });

  /* ---------------- vendors ---------------- */

  app.get(routes.opsVendors.path, async (request) => {
    await requirePermission(request, "vendors.view");
    return admin.listVendors(routes.opsVendors.query!.parse(request.query));
  });

  app.get<{ Params: { id: string } }>(routes.opsVendor.path, async (request) => {
    await requirePermission(request, "vendors.view");
    const { id } = routes.opsVendor.params!.parse(request.params);
    return admin.getVendor(id);
  });

  app.get<{ Params: { id: string } }>(routes.opsVendorOnboarding.path, async (request) => {
    await requirePermission(request, "vendors.view");
    const { id } = routes.opsVendorOnboarding.params!.parse(request.params);
    return getOnboarding(id);
  });

  /* ---------------- vendor verification ---------------- */

  app.get<{ Params: { id: string } }>(routes.opsVendorVerification.path, async (request) => {
    await requirePermission(request, "vendors.view");
    const { id } = routes.opsVendorVerification.params!.parse(request.params);
    return verification.getVerification(id);
  });

  /* ---------------- vendor work and achievements ---------------- */

  app.get<{ Params: { id: string } }>(routes.opsVendorShowcase.path, async (request) => {
    await requirePermission(request, "vendors.view");
    const { id } = routes.opsVendorShowcase.params!.parse(request.params);
    return showcase.getShowcase(id);
  });

  app.post<{ Params: { id: string } }>(routes.opsReviewPortfolioItem.path, async (request) => {
    const staffUserId = await requirePermission(request, "vendors.verify");
    const { id } = routes.opsReviewPortfolioItem.params!.parse(request.params);
    const { decision, note } = routes.opsReviewPortfolioItem.body!.parse(request.body);
    return showcase.reviewPortfolioItem(staffUserId, id, decision, note ?? null);
  });

  app.post<{ Params: { id: string } }>(routes.opsReviewAchievement.path, async (request) => {
    const staffUserId = await requirePermission(request, "vendors.verify");
    const { id } = routes.opsReviewAchievement.params!.parse(request.params);
    const { decision, note } = routes.opsReviewAchievement.body!.parse(request.body);
    return showcase.reviewAchievement(staffUserId, id, decision, note ?? null);
  });

  app.post<{ Params: { id: string } }>(routes.opsReviewSignedCopy.path, async (request) => {
    const staffUserId = await requirePermission(request, "vendors.verify");
    const { id } = routes.opsReviewSignedCopy.params!.parse(request.params);
    const { decision, note } = routes.opsReviewSignedCopy.body!.parse(request.body);
    return verification.reviewSignedCopy(staffUserId, id, decision, note ?? null);
  });

  app.post<{ Params: { id: string } }>(routes.opsReceiveHardcopy.path, async (request) => {
    const staffUserId = await requirePermission(request, "vendors.verify");
    const { id } = routes.opsReceiveHardcopy.params!.parse(request.params);
    const input = routes.opsReceiveHardcopy.body!.parse(request.body);
    return verification.receiveHardcopy(staffUserId, id, input);
  });

  app.post<{ Params: { id: string; documentId: string } }>(
    routes.opsReviewVendorDocument.path,
    async (request) => {
      const staffUserId = await requirePermission(request, "vendors.verify");
      const { id, documentId } = routes.opsReviewVendorDocument.params!.parse(request.params);
      const { decision, note } = routes.opsReviewVendorDocument.body!.parse(request.body);
      return verification.reviewDocument(staffUserId, id, documentId, decision, note ?? null);
    },
  );

  app.get(routes.opsPartnerTerms.path, async (request) => {
    await requirePermission(request, "agreements.view");
    return verification.getPartnerTermsForOps();
  });

  app.patch(routes.opsUpdatePartnerTerms.path, async (request) => {
    const staffUserId = await requirePermission(request, "agreements.manage");
    const input = routes.opsUpdatePartnerTerms.body!.parse(request.body);
    return verification.updatePartnerTerms(staffUserId, input);
  });

  app.patch<{ Params: { id: string } }>(routes.opsSetVendorStatus.path, async (request) => {
    await requirePermission(request, "vendors.verify");
    const { id } = routes.opsSetVendorStatus.params!.parse(request.params);
    const { status } = routes.opsSetVendorStatus.body!.parse(request.body);
    await admin.setVendorStatus(id, status);
    return admin.getVendor(id);
  });

  app.patch<{ Params: { id: string; domainId: string } }>(
    routes.opsSetVendorDomain.path,
    async (request) => {
      const { id, domainId } = routes.opsSetVendorDomain.params!.parse(request.params);
      const patch = routes.opsSetVendorDomain.body!.parse(request.body);

      // Two different decisions behind one endpoint, so two different
      // permissions: approving a trade is not the same as repricing it.
      if (patch.status !== undefined) {
        await requirePermission(request, "vendors.verify");
        await admin.setVendorDomainStatus(id, domainId, patch.status);
      }
      if (patch.commissionPercentOverride !== undefined) {
        await requirePermission(request, "commission.manage");
        await admin.setCommissionOverride(id, domainId, patch.commissionPercentOverride ?? null);
      }

      return admin.getVendor(id);
    },
  );

  /* ---------------- becoming a vendor ---------------- */

  app.get(routes.opsProfessionalApplications.path, async (request) => {
    await requirePermission(request, "vendors.view");
    const { status } = routes.opsProfessionalApplications.query!.parse(request.query);
    return applications.listApplications({ status });
  });

  app.get<{ Params: { id: string } }>(routes.opsProfessionalApplication.path, async (request) => {
    await requirePermission(request, "vendors.view");
    const { id } = routes.opsProfessionalApplication.params!.parse(request.params);
    return applications.getApplication(id);
  });

  /**
   * Approving here is what creates a vendor, so it needs the same permission as
   * verifying one. Anything less would make this the cheaper way to do the
   * thing `vendors.verify` exists to protect.
   */
  app.post<{ Params: { id: string } }>(
    routes.opsDecideProfessionalApplication.path,
    async (request) => {
      const staffUserId = await requirePermission(request, "vendors.verify");
      const { id } = routes.opsDecideProfessionalApplication.params!.parse(request.params);
      const decision = routes.opsDecideProfessionalApplication.body!.parse(request.body);
      return applicationWrite.decideApplication(staffUserId, id, decision);
    },
  );

  /* ---------------- money ---------------- */

  app.get(routes.opsAgreements.path, async (request) => {
    await requirePermission(request, "agreements.view");
    const { limit, cursor } = routes.opsAgreements.query!.parse(request.query);
    return admin.listAllAgreements(limit, cursor);
  });

  app.get(routes.opsInvoices.path, async (request) => {
    await requirePermission(request, "commission.view");
    const { status, limit, cursor } = routes.opsInvoices.query!.parse(request.query);
    return admin.listInvoices(status ?? "all", limit, cursor);
  });

  app.patch<{ Params: { id: string } }>(routes.opsSetInvoiceStatus.path, async (request) => {
    await requirePermission(request, "commission.manage");
    const { id } = routes.opsSetInvoiceStatus.params!.parse(request.params);
    const { status, note } = routes.opsSetInvoiceStatus.body!.parse(request.body);
    await admin.setInvoiceStatus(id, status, note);
    return { ok: true };
  });

  /* ---------------- configuration ---------------- */

  app.get(routes.opsDomains.path, async (request) => {
    await requirePermission(request, "leads.view");
    return admin.listAllDomains();
  });

  app.post(routes.opsCreateDomain.path, async (request, reply) => {
    const staffUserId = await requirePermission(request, "settings.manage");
    const input = routes.opsCreateDomain.body!.parse(request.body);
    reply.status(201);
    return admin.createDomain(input, staffUserId);
  });

  app.patch<{ Params: { id: string } }>(routes.opsUpdateDomain.path, async (request) => {
    const staffUserId = await requirePermission(request, "settings.manage");
    const { id } = routes.opsUpdateDomain.params!.parse(request.params);
    const patch = routes.opsUpdateDomain.body!.parse(request.body);
    return admin.updateDomain(id, patch, staffUserId);
  });

  app.get<{ Params: { id: string } }>(routes.opsDomainUsage.path, async (request) => {
    await requirePermission(request, "settings.manage");
    const { id } = routes.opsDomainUsage.params!.parse(request.params);
    return admin.getDomainUsage(id);
  });

  /* ---------------- where we work ---------------- */

  app.get(routes.opsStates.path, async (request) => {
    await requirePermission(request, "leads.view");
    return admin.listAllStates();
  });

  app.post(routes.opsCreateState.path, async (request, reply) => {
    await requirePermission(request, "settings.manage");
    const input = routes.opsCreateState.body!.parse(request.body);
    reply.code(201);
    return admin.createState(input);
  });

  app.patch<{ Params: { id: string } }>(routes.opsUpdateState.path, async (request) => {
    await requirePermission(request, "settings.manage");
    const { id } = routes.opsUpdateState.params!.parse(request.params);
    const patch = routes.opsUpdateState.body!.parse(request.body);
    return admin.updateState(id, patch);
  });

  app.get(routes.opsCities.path, async (request) => {
    await requirePermission(request, "leads.view");
    return admin.listAllCities();
  });

  app.post(routes.opsCreateCity.path, async (request, reply) => {
    await requirePermission(request, "settings.manage");
    const input = routes.opsCreateCity.body!.parse(request.body);
    reply.code(201);
    return admin.createCity(input);
  });

  app.patch<{ Params: { id: string } }>(routes.opsUpdateCity.path, async (request) => {
    await requirePermission(request, "settings.manage");
    const { id } = routes.opsUpdateCity.params!.parse(request.params);
    const patch = routes.opsUpdateCity.body!.parse(request.body);
    return admin.updateCity(id, patch);
  });

  app.get<{ Params: { id: string } }>(routes.opsCityUsage.path, async (request) => {
    await requirePermission(request, "settings.manage");
    const { id } = routes.opsCityUsage.params!.parse(request.params);
    return admin.getCityUsage(id);
  });


  /* ---------------- catalogue ---------------- */

  /**
   * Reads use `catalog.manage` rather than a viewer permission.
   *
   * These lists exist to be edited — they carry image counts and inactive rows,
   * which is administration, not browsing. Anyone who only needs to look at the
   * catalogue has the public one.
   */
  app.get(routes.opsCategories.path, async (request) => {
    await requirePermission(request, "catalog.manage");
    const { domain } = routes.opsCategories.query!.parse(request.query);
    return admin.listCategoriesForOps(domain);
  });

  app.post(routes.opsCreateCategory.path, async (request, reply) => {
    const staffUserId = await requirePermission(request, "catalog.manage");
    const input = routes.opsCreateCategory.body!.parse(request.body);
    reply.status(201);
    return admin.createCategory(input, staffUserId);
  });

  app.patch<{ Params: { id: string } }>(routes.opsUpdateCategory.path, async (request) => {
    const staffUserId = await requirePermission(request, "catalog.manage");
    const { id } = routes.opsUpdateCategory.params!.parse(request.params);
    const patch = routes.opsUpdateCategory.body!.parse(request.body);
    return admin.updateCategory(id, patch, staffUserId);
  });

  app.get(routes.opsPackages.path, async (request) => {
    await requirePermission(request, "catalog.manage");
    const { domain } = routes.opsPackages.query!.parse(request.query);
    return admin.listPackagesForOps(domain);
  });

  app.post(routes.opsCreatePackage.path, async (request, reply) => {
    // The id is the uploader check for the images: `attachMedia` refuses an
    // asset somebody else uploaded, so a guessed id cannot be pulled into
    // another person's package.
    const staffUserId = await requirePermission(request, "catalog.manage");
    const input = routes.opsCreatePackage.body!.parse(request.body);
    reply.status(201);
    return admin.createPackage(input, staffUserId);
  });

  app.patch<{ Params: { id: string } }>(routes.opsUpdatePackage.path, async (request) => {
    const staffUserId = await requirePermission(request, "catalog.manage");
    const { id } = routes.opsUpdatePackage.params!.parse(request.params);
    const patch = routes.opsUpdatePackage.body!.parse(request.body);
    return admin.updatePackage(id, patch, staffUserId);
  });

  app.get(routes.opsProducts.path, async (request) => {
    await requirePermission(request, "catalog.manage");
    const { domain, category } = routes.opsProducts.query!.parse(request.query);
    return admin.listProductsForOps(domain, category);
  });

  app.post(routes.opsCreateProduct.path, async (request, reply) => {
    const staffUserId = await requirePermission(request, "catalog.manage");
    const input = routes.opsCreateProduct.body!.parse(request.body);
    reply.status(201);
    return admin.createProduct(input, staffUserId);
  });

  app.patch<{ Params: { id: string } }>(routes.opsUpdateProduct.path, async (request) => {
    const staffUserId = await requirePermission(request, "catalog.manage");
    const { id } = routes.opsUpdateProduct.params!.parse(request.params);
    const patch = routes.opsUpdateProduct.body!.parse(request.body);
    return admin.updateProduct(id, patch, staffUserId);
  });

  /* ---------------- support ---------------- */

  app.get(routes.opsTickets.path, async (request) => {
    await requirePermission(request, "leads.view");
    const { status, limit, cursor } = routes.opsTickets.query!.parse(request.query);
    return admin.listTickets(status ?? "all", limit, cursor);
  });

  app.post<{ Params: { id: string } }>(routes.opsReplyToTicket.path, async (request, reply) => {
    const userId = await requirePermission(request, "leads.manage");
    const { id } = routes.opsReplyToTicket.params!.parse(request.params);
    const { body } = routes.opsReplyToTicket.body!.parse(request.body);
    reply.status(201);
    return admin.replyToTicket(userId, id, body);
  });

  app.patch<{ Params: { id: string } }>(routes.opsSetTicketStatus.path, async (request) => {
    await requirePermission(request, "leads.manage");
    const { id } = routes.opsSetTicketStatus.params!.parse(request.params);
    const { status } = routes.opsSetTicketStatus.body!.parse(request.body);
    await admin.setTicketStatus(id, status);
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Who is doing this, as both ids.
 *
 * An admin has no `sales_agents` row, so `salesAgentId` is null for them. An
 * earlier version substituted their user id, which produced a foreign key
 * violation the moment an admin logged a call — the column references
 * `sales_agents`, and pretending otherwise only moved the problem to Postgres.
 */
async function staffActor(
  request: Parameters<typeof requirePermission>[0],
): Promise<{ salesAgentId: string | null; userId: string }> {
  const { currentActor } = await import("../lib/guard");
  const actor = await currentActor(request);

  if (actor?.role === "sales_agent") {
    return { salesAgentId: actor.salesAgentId, userId: actor.userId };
  }
  if (actor?.role === "admin") return { salesAgentId: null, userId: actor.userId };

  throw new Error("Unreachable: permission check passed without a staff actor");
}

async function leadIdForProject(projectId: string): Promise<string> {
  const { db } = await import("../db/client");
  const t = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select({ leadId: t.leadDomains.leadId })
    .from(t.projects)
    .innerJoin(t.leadDomains, eq(t.leadDomains.id, t.projects.leadDomainId))
    .where(eq(t.projects.id, projectId))
    .limit(1);

  return row?.leadId ?? "";
}
