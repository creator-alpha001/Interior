/**
 * The vendor portal.
 *
 * Every handler resolves the professional from the session first. No path takes
 * a professional id, and every repository function below is scoped by the one
 * that comes back — so a vendor cannot read another vendor's leads, quotes or
 * commission by changing anything in a request.
 */
import type { FastifyInstance } from "fastify";
import { routes } from "@repo/contract";
import { requireProfessional } from "../lib/guard";
import * as vendor from "../modules/vendor/repository";
import * as write from "../modules/vendor/mutations";
import { getOnboarding } from "../modules/vendor/onboarding";

export async function registerVendorRoutes(app: FastifyInstance) {
  /**
   * Nothing under /vendor may be cached by anything in front of this server.
   * These responses carry one vendor's pipeline and margins.
   */
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/vendor/")) {
      reply.header("Cache-Control", "no-store, private");
    }
  });

  /* ---------------- leads ---------------- */

  app.get(routes.vendorLeads.path, async (request) => {
    const professionalId = await requireProfessional(request);
    const { filter } = routes.vendorLeads.query!.parse(request.query);
    return vendor.listLeads(professionalId, filter);
  });

  app.get<{ Params: { id: string } }>(routes.vendorLead.path, async (request) => {
    const professionalId = await requireProfessional(request);
    const { id } = routes.vendorLead.params!.parse(request.params);
    return vendor.getLead(professionalId, id);
  });

  app.post<{ Params: { id: string } }>(routes.respondToLead.path, async (request) => {
    const professionalId = await requireProfessional(request);
    const { id } = routes.respondToLead.params!.parse(request.params);
    const { response, reason } = routes.respondToLead.body!.parse(request.body);
    await write.respondToLead(professionalId, id, response, reason);
    return vendor.getLead(professionalId, id);
  });

  app.post<{ Params: { id: string } }>(routes.submitQuote.path, async (request, reply) => {
    const professionalId = await requireProfessional(request);
    const { id } = routes.submitQuote.params!.parse(request.params);
    const draft = routes.submitQuote.body!.parse(request.body);
    reply.status(201);
    return write.submitQuote(professionalId, { ...draft, leadDomainId: id });
  });

  app.get<{ Params: { id: string } }>(routes.vendorThread.path, async (request) => {
    const professionalId = await requireProfessional(request);
    const { id } = routes.vendorThread.params!.parse(request.params);
    return vendor.listThread(professionalId, id);
  });

  app.post<{ Params: { id: string } }>(routes.sendVendorMessage.path, async (request, reply) => {
    const professionalId = await requireProfessional(request);
    const { id } = routes.sendVendorMessage.params!.parse(request.params);
    const { body } = routes.sendVendorMessage.body!.parse(request.body);
    reply.status(201);
    return write.sendMessage(professionalId, id, body);
  });

  /* ---------------- the rest of the portal ---------------- */

  app.get(routes.vendorDashboard.path, async (request) =>
    vendor.getDashboard(await requireProfessional(request)),
  );

  app.get(routes.vendorAgreements.path, async (request) =>
    vendor.listAgreements(await requireProfessional(request)),
  );

  app.get(routes.vendorProjects.path, async (request) =>
    vendor.listProjects(await requireProfessional(request)),
  );

  app.post<{ Params: { id: string; stageId: string } }>(
    routes.submitMilestoneProof.path,
    async (request) => {
      const professionalId = await requireProfessional(request);
      const { id, stageId } = routes.submitMilestoneProof.params!.parse(request.params);
      const { note, proof } = routes.submitMilestoneProof.body!.parse(request.body);

      await write.submitMilestoneProof(professionalId, {
        projectId: id,
        milestoneId: stageId,
        note,
        proof,
      });

      return vendor.listProjects(professionalId);
    },
  );

  app.get(routes.vendorInvoices.path, async (request) =>
    vendor.listInvoices(await requireProfessional(request)),
  );

  app.get(routes.vendorVisits.path, async (request) =>
    vendor.listVisits(await requireProfessional(request)),
  );

  app.get(routes.vendorPerformance.path, async (request) =>
    vendor.getPerformance(await requireProfessional(request)),
  );

  app.get(routes.vendorPortfolio.path, async (request) =>
    vendor.listPortfolio(await requireProfessional(request)),
  );

  /* ---------------- onboarding ---------------- */

  app.get(routes.vendorOnboarding.path, async (request) =>
    getOnboarding(await requireProfessional(request)),
  );

  app.post(routes.signPartnerAgreement.path, async (request, reply) => {
    const professionalId = await requireProfessional(request);
    const input = routes.signPartnerAgreement.body!.parse(request.body);

    reply.status(201);
    return write.signPartnerAgreement(professionalId, input, {
      // Captured here from the request, never accepted from the signatory — a
      // value they supply is not evidence of anything.
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  });
}
