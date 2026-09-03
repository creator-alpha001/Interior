/**
 * What a customer can see.
 *
 * Every query is scoped by the client id from the session. The previous
 * implementation had two reads — `getLead` and `getAgreement` — that checked a
 * record existed but not whose it was; there is no equivalent here, because
 * ownership is in the `WHERE` clause of every one of them.
 */
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import type {
  AgreementView,
  LeadView,
  Message,
  Notification,
  ProjectView,
  SupportTicket,
} from "@repo/types";
import { db } from "../../db/client";
import * as t from "../../db/schema";
import { NotFoundError } from "../../lib/errors";
import { buildAgreementViews, buildLeadViews, buildProjectViews } from "./views";

export async function listRequirements(clientId: string): Promise<LeadView[]> {
  const rows = await db
    .select({ id: t.leads.id })
    .from(t.leads)
    .where(
      and(
        eq(t.leads.clientId, clientId),
        // Archived requirements are ops housekeeping, not something a customer
        // needs to scroll past.
        ne(t.leads.overallStatus, "archived"),
        isNull(t.leads.deletedAt),
      ),
    )
    .orderBy(desc(t.leads.createdAt));

  // buildLeadViews loads by id set and does not preserve order, so newest-first
  // is restored here — the account screens rely on it.
  const views = await buildLeadViews(rows.map((r) => r.id));
  return views.sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt));
}

export async function getRequirement(clientId: string, leadId: string): Promise<LeadView> {
  const [row] = await db
    .select({ id: t.leads.id })
    .from(t.leads)
    .where(and(eq(t.leads.id, leadId), eq(t.leads.clientId, clientId), isNull(t.leads.deletedAt)))
    .limit(1);

  if (!row) throw new NotFoundError("That requirement");

  const [view] = await buildLeadViews([row.id]);
  return view!;
}

export async function listAgreements(clientId: string): Promise<AgreementView[]> {
  const rows = await db
    .select({ id: t.agreements.id })
    .from(t.agreements)
    .where(and(eq(t.agreements.clientId, clientId), isNull(t.agreements.deletedAt)))
    .orderBy(desc(t.agreements.createdAt));

  const views = await buildAgreementViews(rows.map((r) => r.id));
  return views.sort((a, b) => b.agreement.createdAt.localeCompare(a.agreement.createdAt));
}

export async function listProjects(clientId: string): Promise<ProjectView[]> {
  const rows = await db
    .select({ id: t.projects.id })
    .from(t.projects)
    .where(and(eq(t.projects.clientId, clientId), isNull(t.projects.deletedAt)))
    .orderBy(desc(t.projects.createdAt));

  return buildProjectViews(rows.map((r) => r.id));
}

/**
 * The customer's thread with the platform for one service.
 *
 * `channel` is filtered here *and* the table has a check constraint making the
 * other channel structurally impossible on a client row. Two layers, because
 * this is the leak that would matter most: the vendor thread is where prices
 * and margins are discussed.
 */
export async function listMessages(clientId: string, leadDomainId: string): Promise<Message[]> {
  const [owned] = await db
    .select({ id: t.leadDomains.id })
    .from(t.leadDomains)
    .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
    .where(and(eq(t.leadDomains.id, leadDomainId), eq(t.leads.clientId, clientId)))
    .limit(1);

  if (!owned) throw new NotFoundError("That service");

  const rows = await db
    .select()
    .from(t.messages)
    .where(
      and(
        eq(t.messages.leadDomainId, leadDomainId),
        eq(t.messages.channel, "client_platform"),
        isNull(t.messages.deletedAt),
      ),
    )
    .orderBy(asc(t.messages.createdAt));

  return rows as unknown as Message[];
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(t.notifications)
    .where(and(eq(t.notifications.userId, userId), isNull(t.notifications.deletedAt)))
    .orderBy(desc(t.notifications.createdAt))
    .limit(100);

  return rows as unknown as Notification[];
}

export async function listTickets(userId: string): Promise<SupportTicket[]> {
  const rows = await db
    .select()
    .from(t.supportTickets)
    .where(and(eq(t.supportTickets.raisedByUserId, userId), isNull(t.supportTickets.deletedAt)))
    .orderBy(desc(t.supportTickets.createdAt));

  if (rows.length === 0) return [];

  const allReplies = await db
    .select()
    .from(t.ticketReplies)
    .where(
      inArray(
        t.ticketReplies.ticketId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(t.ticketReplies.createdAt));

  return rows.map((ticket) => ({
    ...ticket,
    replies: allReplies
      .filter((r) => r.ticketId === ticket.id)
      .map((r) => ({
        id: r.id,
        authorRole: r.authorRole,
        authorName: r.authorName,
        body: r.body,
        createdAt: r.createdAt,
      })),
  })) as unknown as SupportTicket[];
}

export interface ReferralSummary {
  code: string;
  shareUrl: string;
  invited: number;
  earned: number;
  pending: number;
  rewardPerReferral: number;
  referrals: Array<{ referral: typeof t.referrals.$inferSelect; name: string }>;
}

export async function getReferralSummary(clientId: string): Promise<ReferralSummary> {
  const [client] = await db
    .select({ client: t.clients, userId: t.users.id })
    .from(t.clients)
    .innerJoin(t.users, eq(t.users.id, t.clients.userId))
    .where(eq(t.clients.id, clientId))
    .limit(1);

  if (!client) throw new NotFoundError("That account");

  const rows = await db
    .select({ referral: t.referrals, name: t.users.name })
    .from(t.referrals)
    .innerJoin(t.users, eq(t.users.id, t.referrals.referredUserId))
    .where(eq(t.referrals.referrerUserId, client.userId))
    .orderBy(desc(t.referrals.createdAt));

  const sum = (statuses: string[]) =>
    rows
      .filter((r) => statuses.includes(r.referral.rewardStatus))
      .reduce((total, r) => total + r.referral.rewardAmount, 0);

  return {
    code: client.client.referralCode,
    shareUrl: `https://aangan.example.com/join?ref=${client.client.referralCode}`,
    invited: rows.length,
    earned: sum(["paid", "earned"]),
    pending: sum(["pending"]),
    rewardPerReferral: 1000,
    referrals: rows.map((r) => ({ referral: r.referral, name: r.name })),
  };
}
