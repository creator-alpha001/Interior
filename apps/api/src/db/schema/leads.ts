/**
 * The spine of the platform.
 *
 * One `leads` row per requirement submission, and one `lead_domains` row per
 * service the customer selected. Every downstream track — assignment, quoting,
 * visits, agreements, execution — hangs off `lead_domains`, never off the lead.
 * That is what lets "just a dining table" and "2BHK interior plus painting plus
 * a steel gate" run through identical code paths.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { SiteAccessibilityTag } from "@repo/types";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { cities } from "./geo";
import { clients, professionals, salesAgents, users } from "./identity";
import { domains } from "./domains";
import { products, servicePackages } from "./catalog";
import {
  assignmentResponse,
  callStatus,
  leadDomainStatus,
  leadSource,
  leadStatus,
  materialSource,
  urgency,
} from "./enums";

export const leads = pgTable(
  "leads",
  {
    id: primaryId(),
    /**
     * "LD-1042". Fed by a sequence, not a row count — the previous
     * implementation counted array length, which races and collides after
     * deletes.
     */
    reference: varchar("reference", { length: 24 }).notNull(),
    clientId: fk("client_id")
      .notNull()
      .references(() => clients.id),
    cityId: fk("city_id")
      .notNull()
      .references(() => cities.id),
    /** The customer's own words. Real scoping happens on the sales call. */
    description: text("description").notNull(),
    urgency: urgency("urgency").notNull(),
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    siteAccessibilityTags: jsonb("site_accessibility_tags")
      .$type<SiteAccessibilityTag[]>()
      .notNull()
      .default([]),
    source: leadSource("source").notNull().default("app"),
    /**
     * Derived from this lead's lead_domains by a trigger, never written
     * directly. The frontend documented it as derived but four mutations
     * changed a lead_domain status without recomputing it, so it went stale.
     */
    overallStatus: leadStatus("overall_status").notNull().default("new"),
    assignedSalesAgentId: fk("assigned_sales_agent_id").references(() => salesAgents.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_lead_reference").on(t.reference),
    index("ix_lead_client").on(t.clientId, t.createdAt),
    index("ix_lead_queue").on(t.overallStatus, t.urgency, t.createdAt),
    index("ix_lead_agent").on(t.assignedSalesAgentId),
    index("ix_lead_city").on(t.cityId),
  ],
);

export const leadDomains = pgTable(
  "lead_domains",
  {
    id: primaryId(),
    leadId: fk("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    domainId: fk("domain_id")
      .notNull()
      .references(() => domains.id),
    /** Per service: a client can supply their own wood but not their own paint. */
    materialSource: materialSource("material_source").notNull().default("undecided"),
    status: leadDomainStatus("status").notNull().default("pending_assignment"),
    /**
     * A vendor the client asked for by name. A preference, never a promise —
     * ops try to include them among the three and must say why if they cannot.
     */
    preferredProfessionalId: fk("preferred_professional_id").references(() => professionals.id),
    preferenceUnmetReason: text("preference_unmet_reason"),
    selectedProfessionalId: fk("selected_professional_id").references(() => professionals.id),
    /**
     * Deliberately untyped as a reference here. The migration adds a *composite*
     * foreign key (selected_quote_id, id) -> quotes (id, lead_domain_id), which
     * makes it structurally impossible to select a quote belonging to a
     * different service. `selectQuote` never checked that.
     */
    selectedQuoteId: fk("selected_quote_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_lead_domain").on(t.leadId, t.domainId),
    index("ix_lead_domain_lead").on(t.leadId),
    index("ix_lead_domain_queue").on(t.status, t.domainId),
    index("ix_lead_domain_selected").on(t.selectedProfessionalId),
  ],
);

/**
 * Which vendors were offered this service.
 *
 * Assignment is manual: ops phone the vendor, confirm availability, then
 * assign. Nobody is auto-matched into a job they have not agreed to.
 */
export const leadDomainAssignments = pgTable(
  "lead_domain_assignments",
  {
    id: primaryId(),
    leadDomainId: fk("lead_domain_id")
      .notNull()
      .references(() => leadDomains.id, { onDelete: "cascade" }),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id),
    responseStatus: assignmentResponse("response_status").notNull().default("pending"),
    assignedAt: ts("assigned_at").notNull().defaultNow(),
    respondedAt: ts("responded_at"),
    rejectionReason: text("rejection_reason"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_assignment").on(t.leadDomainId, t.professionalId),
    index("ix_assignment_professional").on(t.professionalId, t.assignedAt),
  ],
);

/**
 * The bridge from catalogue to lead.
 *
 * When a customer browses and enquires, their selection lands here so the
 * vendor quotes against exactly what was picked rather than a description of it.
 */
export const leadDomainItems = pgTable(
  "lead_domain_items",
  {
    id: primaryId(),
    leadDomainId: fk("lead_domain_id")
      .notNull()
      .references(() => leadDomains.id, { onDelete: "cascade" }),
    productId: fk("product_id").references(() => products.id),
    packageId: fk("package_id").references(() => servicePackages.id),
    /** Snapshot of the name at selection time; catalogue names change. */
    itemName: text("item_name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    selectedOptions: jsonb("selected_options")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    indicativePrice: integer("indicative_price"),
    customerNotes: text("customer_notes"),
    ...timestamps,
  },
  (t) => [index("ix_lead_domain_item").on(t.leadDomainId)],
);

/**
 * The call log — where the scoping the customer form deliberately left out
 * actually gets captured: exact sizes, finishes, site constraints.
 */
export const leadSalesActivities = pgTable(
  "lead_sales_activities",
  {
    id: primaryId(),
    leadId: fk("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /**
     * Which agent owns this lead. Null where the call was made by somebody who
     * is not a sales agent — an admin covering, most often.
     */
    salesAgentId: fk("sales_agent_id").references(() => salesAgents.id),
    /** Who actually made the call. Always set for anything logged from now on. */
    loggedByUserId: fk("logged_by_user_id").references(() => users.id),
    callStatus: callStatus("call_status").notNull(),
    remarks: text("remarks").notNull().default(""),
    recordingUrl: text("recording_url"),
    followUpDate: date("follow_up_date"),
    ...timestamps,
  },
  (t) => [
    index("ix_activity_lead").on(t.leadId, t.createdAt),
    // Drives the "follow-ups due today" job and the My Day screen.
    index("ix_activity_followup")
      .on(t.followUpDate)
      .where(sql`${t.followUpDate} IS NOT NULL`),
  ],
);
