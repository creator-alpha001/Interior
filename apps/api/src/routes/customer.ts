/**
 * The customer surface, and uploads.
 *
 * Every handler starts by asking the session who is calling. No path takes a
 * customer id, so there is no parameter to tamper with — and the repository
 * functions below all scope by that id, so a guessed record id returns 404
 * rather than somebody else's data.
 */
import type { FastifyInstance } from "fastify";
import { routes } from "@repo/contract";
import { currentActor, requireClient, requireUser } from "../lib/guard";
import { LIMITS, consume } from "../lib/rate-limit";
import * as customer from "../modules/customer/repository";
import * as write from "../modules/customer/mutations";
import { createUploadTicket } from "../modules/uploads/repository";

export async function registerCustomerRoutes(app: FastifyInstance) {
  /**
   * Nothing under /me may be cached by anything in front of this server.
   * A shared cache holding one person's requirements and serving them to the
   * next visitor is the worst failure this API could have.
   */
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/me/") || request.url === "/me") {
      reply.header("Cache-Control", "no-store, private");
    }
  });

  /* ---------------- uploads ---------------- */

  app.post(routes.createUploadTicket.path, async (request) => {
    const actor = await currentActor(request);
    const input = routes.createUploadTicket.body!.parse(request.body);

    // A signed-out visitor may only ask for a requirement-photo ticket, and the
    // repository enforces that. The limit here is what stops the endpoint being
    // free object storage for anybody who finds it.
    if (!actor) {
      await consume(`upload:ip:${request.ip}`, LIMITS.anonymousUploadPerIp);
    }

    return createUploadTicket(actor?.userId ?? null, input);
  });

  /* ---------------- requirements ---------------- */

  app.get(routes.listRequirements.path, async (request) => {
    return customer.listRequirements(await requireClient(request));
  });

  app.get<{ Params: { id: string } }>(routes.getRequirement.path, async (request) => {
    const clientId = await requireClient(request);
    const { id } = routes.getRequirement.params!.parse(request.params);
    return customer.getRequirement(clientId, id);
  });

  app.post(routes.createRequirement.path, async (request, reply) => {
    const clientId = await requireClient(request);
    const input = routes.createRequirement.body!.parse(request.body);
    reply.status(201);
    return write.submitRequirement(clientId, input);
  });

  /* ---------------- one service ---------------- */

  app.get<{ Params: { id: string } }>(routes.listServiceMessages.path, async (request) => {
    const clientId = await requireClient(request);
    const { id } = routes.listServiceMessages.params!.parse(request.params);
    return customer.listMessages(clientId, id);
  });

  app.post<{ Params: { id: string } }>(routes.sendServiceMessage.path, async (request, reply) => {
    const clientId = await requireClient(request);
    const { id } = routes.sendServiceMessage.params!.parse(request.params);
    const { body } = routes.sendServiceMessage.body!.parse(request.body);
    reply.status(201);
    return write.sendMessage(clientId, id, body);
  });

  app.post<{ Params: { id: string } }>(routes.selectQuote.path, async (request) => {
    const clientId = await requireClient(request);
    const { id } = routes.selectQuote.params!.parse(request.params);
    const { quoteId } = routes.selectQuote.body!.parse(request.body);
    return write.selectQuote(clientId, id, quoteId);
  });

  /* ---------------- agreements ---------------- */

  app.get(routes.listAgreements.path, async (request) => {
    return customer.listAgreements(await requireClient(request));
  });

  app.post<{ Params: { id: string } }>(routes.generateAgreements.path, async (request) => {
    const clientId = await requireClient(request);
    const { id } = routes.generateAgreements.params!.parse(request.params);
    await write.generateAgreements(clientId, id);
    return customer.listAgreements(clientId);
  });

  app.post<{ Params: { id: string } }>(routes.signAgreement.path, async (request) => {
    const clientId = await requireClient(request);
    const { id } = routes.signAgreement.params!.parse(request.params);
    return write.signAgreement(clientId, id);
  });

  /* ---------------- projects ---------------- */

  app.get(routes.listProjects.path, async (request) => {
    return customer.listProjects(await requireClient(request));
  });

  app.post(routes.submitReview.path, async (request, reply) => {
    const clientId = await requireClient(request);
    const input = routes.submitReview.body!.parse(request.body);
    reply.status(201);
    return write.submitReview(clientId, input);
  });

  app.post<{ Params: { id: string } }>(routes.requestReschedule.path, async (request) => {
    const clientId = await requireClient(request);
    const { id } = routes.requestReschedule.params!.parse(request.params);
    const { note } = routes.requestReschedule.body!.parse(request.body);
    return write.requestReschedule(clientId, id, note);
  });

  /* ---------------- notifications, tickets, referrals ---------------- */

  app.get(routes.listNotifications.path, async (request) => {
    return customer.listNotifications(await requireUser(request));
  });

  app.post(routes.markNotificationsRead.path, async (request) => {
    const count = await write.markNotificationsRead(await requireUser(request));
    return { count };
  });

  app.get(routes.listTickets.path, async (request) => {
    return customer.listTickets(await requireUser(request));
  });

  app.post(routes.createTicket.path, async (request, reply) => {
    const userId = await requireUser(request);
    const input = routes.createTicket.body!.parse(request.body);
    reply.status(201);
    return write.createTicket(userId, input);
  });

  app.post<{ Params: { id: string } }>(routes.replyToTicket.path, async (request, reply) => {
    const userId = await requireUser(request);
    const { id } = routes.replyToTicket.params!.parse(request.params);
    const { body } = routes.replyToTicket.body!.parse(request.body);
    reply.status(201);
    return write.replyToTicket(userId, id, body);
  });

  app.get(routes.referrals.path, async (request) => {
    return customer.getReferralSummary(await requireClient(request));
  });
}
