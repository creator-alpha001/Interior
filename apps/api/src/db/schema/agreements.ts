/**
 * Contracts: the customer's with a vendor, and every vendor's with us.
 *
 * Customer agreements group by PROFESSIONAL, not by service. Different vendors
 * across services means one contract each; the same vendor across several
 * services collapses into one combined contract with one commission invoice,
 * while execution stays tracked per service.
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
import type { PartnerTerms } from "@repo/types";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { clients, professionals } from "./identity";
import { leads, leadDomains } from "./leads";
import { quotes } from "./flow";
import { agreementStatus, partnerAgreementStatus } from "./enums";

export const agreements = pgTable(
  "agreements",
  {
    id: primaryId(),
    reference: varchar("reference", { length: 32 }).notNull(),
    leadId: fk("lead_id")
      .notNull()
      .references(() => leads.id),
    clientId: fk("client_id")
      .notNull()
      .references(() => clients.id),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id),
    /** Sum of the accepted quote totals this agreement covers. */
    totalValue: integer("total_value").notNull(),
    /**
     * Money moves off-platform for now, so terms are recorded rather than
     * enforced. An escrow module can later read from this shape.
     */
    paymentTerms: text("payment_terms").notNull().default(""),
    status: agreementStatus("status").notNull().default("draft"),
    documentUrl: text("document_url"),
    sentAt: ts("sent_at"),
    signedAt: ts("signed_at"),
    startDate: date("start_date"),
    cancelledReason: text("cancelled_reason"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_agreement_reference").on(t.reference),
    // One agreement per vendor per lead. A second live one would mean the same
    // work contracted twice and billed twice.
    uniqueIndex("uq_agreement_lead_professional")
      .on(t.leadId, t.professionalId)
      .where(sql`${t.status} <> 'cancelled'`),
    index("ix_agreement_client").on(t.clientId, t.createdAt),
    index("ix_agreement_professional").on(t.professionalId, t.status),
  ],
);

/** Which services a given agreement covers, and at what quoted value. */
export const agreementLeadDomains = pgTable(
  "agreement_lead_domains",
  {
    id: primaryId(),
    agreementId: fk("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "cascade" }),
    leadDomainId: fk("lead_domain_id")
      .notNull()
      .references(() => leadDomains.id),
    /** The accepted quote at signing time. */
    quoteId: fk("quote_id")
      .notNull()
      .references(() => quotes.id),
    value: integer("value").notNull(),
    ...timestamps,
  },
  (t) => [
    // A service belongs to exactly one agreement.
    uniqueIndex("uq_agreement_lead_domain").on(t.leadDomainId),
    index("ix_agreement_line_agreement").on(t.agreementId),
  ],
);

/* ------------------------------------------------------------------ *
 * The platform's own agreement with its vendors
 * ------------------------------------------------------------------ */

/**
 * Versioned terms.
 *
 * Which set a vendor actually agreed to is the whole point — an agreement
 * pointing at "the current terms" is worth very little once the terms move on.
 */
export const partnerTerms = pgTable(
  "partner_terms",
  {
    version: varchar("version", { length: 20 }).primaryKey(),
    effectiveFrom: date("effective_from").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    sections: jsonb("sections")
      .$type<PartnerTerms["sections"]>()
      .notNull()
      .default([]),
    /** Clauses ticked individually rather than swept into one "I agree". */
    acknowledgements: jsonb("acknowledgements")
      .$type<PartnerTerms["acknowledgements"]>()
      .notNull()
      .default([]),
    /**
     * True on exactly one row, NULL on the rest. NULL rather than false so the
     * partial unique index below can enforce "only one current version" —
     * Postgres treats NULLs as distinct, so any number of past versions coexist.
     */
    isCurrent: boolean("is_current"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_partner_terms_current")
      .on(t.isCurrent)
      .where(sql`${t.isCurrent} IS NOT NULL`),
  ],
);

/**
 * A vendor's signature against one version of the terms.
 *
 * Signing is what unlocks lead assignment: an unsigned vendor is in no pool,
 * however verified their account or approved their trades.
 */
export const partnerAgreements = pgTable(
  "partner_agreements",
  {
    id: primaryId(),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    termsVersion: varchar("terms_version", { length: 20 })
      .notNull()
      .references(() => partnerTerms.version),
    status: partnerAgreementStatus("status").notNull().default("pending"),
    /** The name typed, stored exactly as entered. */
    signatureText: text("signature_text"),
    signatoryName: text("signatory_name"),
    signatoryRole: text("signatory_role"),
    signedAt: ts("signed_at"),
    /** Every clause ticked, so consent can be proved clause by clause. */
    acknowledgedClauses: jsonb("acknowledged_clauses").$type<string[]>().notNull().default([]),
    /**
     * Captured server-side from the request, never from the client. The
     * frontend sent placeholder strings; a value the signatory supplies is not
     * evidence of anything.
     */
    signedFromIp: varchar("signed_from_ip", { length: 45 }),
    signedUserAgent: text("signed_user_agent"),
    documentUrl: text("document_url"),
    ...timestamps,
  },
  (t) => [
    // At most one live agreement per vendor; signing a new version supersedes.
    uniqueIndex("uq_partner_agreement_live")
      .on(t.professionalId)
      .where(sql`${t.status} <> 'superseded'`),
    index("ix_partner_agreement_status").on(t.status, t.termsVersion),
  ],
);
