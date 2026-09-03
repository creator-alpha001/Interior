/**
 * What our team can change.
 *
 * Assignment is the one that matters most. It is manual on purpose — a
 * coordinator phones the vendor, confirms they can take it, and only then
 * assigns — and it re-checks eligibility at the moment of writing rather than
 * trusting that the pool it came from was filtered. The previous implementation
 * did not, so a stale page or a hand-made request could assign a suspended or
 * unsigned vendor.
 */
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Meeting, MeetingType, Message } from "@repo/types";
import { db, transaction } from "../../db/client";
import * as t from "../../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors";

/* ------------------------------------------------------------------ *
 * Assignment
 * ------------------------------------------------------------------ */

/**
 * Offers a service to a set of vendors.
 *
 * Everything happens in one transaction: the assignments, the notifications to
 * each vendor, the service status, and the note explaining an unmet preference.
 * A half-applied version of that means somebody is told they have a lead they
 * were not actually given.
 */
export async function assignProfessionals(
  leadDomainId: string,
  professionalIds: string[],
): Promise<void> {
  if (professionalIds.length === 0) {
    throw new ValidationError("Choose at least one professional");
  }

  await transaction(async (tx) => {
    const [row] = await tx
      .select({ leadDomain: t.leadDomains, lead: t.leads })
      .from(t.leadDomains)
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .where(eq(t.leadDomains.id, leadDomainId))
      .limit(1);

    if (!row) throw new NotFoundError("That service");

    /**
     * Re-checked here, not taken on trust from the pool the coordinator was
     * looking at. That page may be minutes old, and a vendor can be suspended
     * or have their trade approval withdrawn in between.
     */
    const eligible = await tx.execute<{ professional_id: string }>(sql`
      SELECT DISTINCT professional_id
      FROM eligible_vendors
      WHERE domain_id = ${row.leadDomain.domainId}
        AND city_id = ${row.lead.cityId}
        AND professional_id = ANY(${sql.param(professionalIds)}::uuid[])
    `);

    const allowed = new Set(
      (eligible as unknown as Array<{ professional_id: string }>).map((r) => r.professional_id),
    );
    const refused = professionalIds.filter((id) => !allowed.has(id));

    if (refused.length > 0) {
      throw new ConflictError(
        "One of those professionals is no longer eligible for this service — they may have been suspended, or their trade approval or partner agreement may have lapsed.",
        { refused },
      );
    }

    const existing = await tx
      .select({ professionalId: t.leadDomainAssignments.professionalId })
      .from(t.leadDomainAssignments)
      .where(eq(t.leadDomainAssignments.leadDomainId, leadDomainId));

    const already = new Set(existing.map((e) => e.professionalId));
    const fresh = professionalIds.filter((id) => !already.has(id));

    if (fresh.length > 0) {
      await tx.insert(t.leadDomainAssignments).values(
        fresh.map((professionalId) => ({
          leadDomainId,
          professionalId,
          // Accepted on creation: ops only assign after the vendor has said yes
          // on the phone. The vendor can still decline in the portal.
          responseStatus: "accepted" as const,
          assignedAt: new Date().toISOString(),
          respondedAt: new Date().toISOString(),
        })),
      );

      const vendorUsers = await tx
        .select({ professionalId: t.professionals.id, userId: t.users.id })
        .from(t.professionals)
        .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
        .where(inArray(t.professionals.id, fresh));

      if (vendorUsers.length > 0) {
        await tx.insert(t.notifications).values(
          vendorUsers.map((v) => ({
            userId: v.userId,
            type: "new_lead" as const,
            title: "A new lead has been assigned to you",
            body: `${row.lead.reference} — open it in your portal to quote.`,
            entityType: "lead_domain" as const,
            entityId: leadDomainId,
          })),
        );
      }
    }

    await tx
      .update(t.leadDomains)
      .set({
        status: row.leadDomain.status === "pending_assignment" ? "assigned" : row.leadDomain.status,
        // A client who asked for somebody by name deserves to be told when we
        // could not include them, rather than left to notice.
        preferenceUnmetReason:
          row.leadDomain.preferredProfessionalId &&
          !professionalIds.includes(row.leadDomain.preferredProfessionalId)
            ? "The professional you asked for was not available for this job, so we have put forward others we would use ourselves."
            : row.leadDomain.preferenceUnmetReason,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(t.leadDomains.id, leadDomainId));

    const [client] = await tx
      .select({ userId: t.users.id })
      .from(t.leads)
      .innerJoin(t.clients, eq(t.clients.id, t.leads.clientId))
      .innerJoin(t.users, eq(t.users.id, t.clients.userId))
      .where(eq(t.leads.id, row.lead.id))
      .limit(1);

    if (client) {
      await tx.insert(t.notifications).values({
        userId: client.userId,
        type: "professional_assigned",
        title: "Professionals assigned to your requirement",
        body: `We have put ${professionalIds.length} verified professionals on ${row.lead.reference}.`,
        entityType: "lead_domain",
        entityId: leadDomainId,
      });
    }
  });
}

export async function setLeadDomainStatus(
  leadDomainId: string,
  status: (typeof t.leadDomains.$inferSelect)["status"],
): Promise<void> {
  const rows = await db
    .update(t.leadDomains)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(t.leadDomains.id, leadDomainId))
    .returning({ id: t.leadDomains.id });

  if (rows.length === 0) throw new NotFoundError("That service");
  // The lead's own status is derived by trigger, so nothing to recompute here.
}

/* ------------------------------------------------------------------ *
 * Calls and visits
 * ------------------------------------------------------------------ */

export interface CallLogInput {
  leadId: string;
  callStatus: (typeof t.leadSalesActivities.$inferSelect)["callStatus"];
  remarks: string;
  followUpDate?: string | null;
}

/**
 * The call log — where the scoping the customer form deliberately left out
 * actually gets captured.
 *
 * Logging the first call also claims the lead for that agent and promotes it
 * out of "new", which is why it is a transaction rather than an insert.
 */
export async function logCall(agentId: string, input: CallLogInput) {
  return transaction(async (tx) => {
    const [lead] = await tx
      .select()
      .from(t.leads)
      .where(eq(t.leads.id, input.leadId))
      .limit(1)
      .for("update");

    if (!lead) throw new NotFoundError("That lead");

    const [activity] = await tx
      .insert(t.leadSalesActivities)
      .values({
        leadId: input.leadId,
        salesAgentId: agentId,
        callStatus: input.callStatus,
        remarks: input.remarks,
        followUpDate: input.followUpDate ?? null,
      })
      .returning();

    // First to call it owns it. The lead status is derived by trigger from the
    // agent column changing.
    if (!lead.assignedSalesAgentId) {
      await tx
        .update(t.leads)
        .set({ assignedSalesAgentId: agentId, updatedAt: new Date().toISOString() })
        .where(eq(t.leads.id, input.leadId));
    }

    return activity!;
  });
}

export interface ScheduleVisitInput {
  leadDomainId: string;
  professionalId: string;
  scheduledAt: string;
  type: MeetingType;
  notes?: string | null;
}

/**
 * Booking a site visit.
 *
 * The coordinator confirms the slot with both sides separately — neither party
 * books the other. This is also the moment the customer's address is released
 * to that vendor, and the only moment it ever is.
 */
export async function scheduleVisit(
  coordinatorId: string,
  input: ScheduleVisitInput,
): Promise<Meeting> {
  return transaction(async (tx) => {
    const [row] = await tx
      .select({ address: t.clients.address, cityName: t.cities.name, reference: t.leads.reference })
      .from(t.leadDomains)
      .innerJoin(t.leads, eq(t.leads.id, t.leadDomains.leadId))
      .innerJoin(t.clients, eq(t.clients.id, t.leads.clientId))
      .innerJoin(t.cities, eq(t.cities.id, t.leads.cityId))
      .where(eq(t.leadDomains.id, input.leadDomainId))
      .limit(1);

    if (!row) throw new NotFoundError("That service");

    const [assigned] = await tx
      .select({ id: t.leadDomainAssignments.id })
      .from(t.leadDomainAssignments)
      .where(
        and(
          eq(t.leadDomainAssignments.leadDomainId, input.leadDomainId),
          eq(t.leadDomainAssignments.professionalId, input.professionalId),
          ne(t.leadDomainAssignments.responseStatus, "rejected"),
        ),
      )
      .limit(1);

    if (!assigned) {
      throw new ConflictError("That professional is not assigned to this service");
    }

    const [meeting] = await tx
      .insert(t.meetings)
      .values({
        leadDomainId: input.leadDomainId,
        professionalId: input.professionalId,
        type: input.type,
        scheduledAt: input.scheduledAt,
        location: row.address ?? row.cityName,
        status: "confirmed",
        notes: input.notes ?? null,
        coordinatorId,
        // The address becomes visible to this vendor from here, for this
        // service only. Nothing else in the system sets this column.
        addressReleasedAt: new Date().toISOString(),
      })
      .returning();

    const [pro] = await tx
      .select({ userId: t.users.id })
      .from(t.professionals)
      .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
      .where(eq(t.professionals.id, input.professionalId))
      .limit(1);

    if (pro) {
      await tx.insert(t.notifications).values({
        userId: pro.userId,
        type: "meeting_confirmed",
        title: "Site visit confirmed",
        body: `${row.reference} — the address is now on the job in your portal.`,
        entityType: "meeting",
        entityId: meeting!.id,
      });
    }

    return meeting as unknown as Meeting;
  });
}

/**
 * Writing up what a visit established.
 *
 * Optional, because not every visit produces news. When it does, this is what
 * stops the same question being asked twice and what every vendor quoting the
 * job should be working from.
 */
export async function recordVisitOutcome(
  meetingId: string,
  outcome: string,
  changedScope: boolean,
): Promise<void> {
  const rows = await db
    .update(t.meetings)
    .set({
      outcome,
      outcomeRecordedAt: new Date().toISOString(),
      outcomeChangedScope: changedScope,
      status: sql`CASE WHEN ${t.meetings.status} IN ('scheduled', 'confirmed')
                       THEN 'completed'::meeting_status ELSE ${t.meetings.status} END`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(t.meetings.id, meetingId))
    .returning({ id: t.meetings.id });

  if (rows.length === 0) throw new NotFoundError("That visit");
}

/* ------------------------------------------------------------------ *
 * The relay
 * ------------------------------------------------------------------ */

export async function replyToClient(
  agentId: string,
  leadDomainId: string,
  body: string,
  sourceMessageId?: string,
): Promise<Message> {
  const [message] = await db
    .insert(t.messages)
    .values({
      leadDomainId,
      channel: "client_platform",
      senderRole: "platform",
      senderId: agentId,
      professionalId: null,
      body,
      relayedFromMessageId: sourceMessageId ?? null,
    })
    .returning();

  return message as unknown as Message;
}

/**
 * One question, put to every assigned vendor at once.
 *
 * This is the point of routing through us rather than one-to-one: the customer
 * asks once, all three answer, and the comparison stays honest.
 */
export async function relayToVendors(
  agentId: string,
  leadDomainId: string,
  body: string,
  sourceMessageId?: string,
): Promise<Message[]> {
  const vendors = await db
    .select({ professionalId: t.leadDomainAssignments.professionalId })
    .from(t.leadDomainAssignments)
    .where(
      and(
        eq(t.leadDomainAssignments.leadDomainId, leadDomainId),
        eq(t.leadDomainAssignments.responseStatus, "accepted"),
      ),
    );

  if (vendors.length === 0) return [];

  const rows = await db
    .insert(t.messages)
    .values(
      vendors.map((v) => ({
        leadDomainId,
        channel: "platform_vendor" as const,
        senderRole: "platform" as const,
        senderId: agentId,
        professionalId: v.professionalId,
        body,
        relayedFromMessageId: sourceMessageId ?? null,
      })),
    )
    .returning();

  return rows as unknown as Message[];
}

/* ------------------------------------------------------------------ *
 * Stage approval
 * ------------------------------------------------------------------ */

/**
 * Accepting or rejecting a vendor's evidence.
 *
 * This is the only thing that moves the completion a customer sees. The
 * percentage itself is recomputed by trigger from approved stages, so there is
 * no number to set here — only a judgement to record.
 */
export async function reviewMilestoneProof(
  reviewerUserId: string,
  projectId: string,
  milestoneId: string,
  approve: boolean,
  note: string | null,
): Promise<void> {
  const [milestone] = await db
    .select({ id: t.projectMilestones.id, verification: t.projectMilestones.verification })
    .from(t.projectMilestones)
    .where(
      and(eq(t.projectMilestones.id, milestoneId), eq(t.projectMilestones.projectId, projectId)),
    )
    .limit(1);

  if (!milestone) throw new NotFoundError("That stage");
  if (milestone.verification === "not_started") {
    throw new ConflictError("Nothing has been submitted for that stage yet");
  }

  await db
    .update(t.projectMilestones)
    .set({
      verification: approve ? "approved" : "rejected",
      completedAt: approve ? new Date().toISOString() : null,
      verifiedAt: new Date().toISOString(),
      verifiedByUserId: reviewerUserId,
      verifierNote: note,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(t.projectMilestones.id, milestoneId));

  const [project] = await db
    .select({ professionalUserId: t.users.id, reference: t.projects.reference })
    .from(t.projects)
    .innerJoin(t.professionals, eq(t.professionals.id, t.projects.professionalId))
    .innerJoin(t.users, eq(t.users.id, t.professionals.userId))
    .where(eq(t.projects.id, projectId))
    .limit(1);

  if (project) {
    await db.insert(t.notifications).values({
      userId: project.professionalUserId,
      type: "project_started",
      title: approve ? "Stage approved" : "Stage sent back",
      body: note ?? `${project.reference} — see the stage in your portal.`,
      entityType: "project",
      entityId: projectId,
    });
  }
}
