/**
 * The product's guarantees, asserted against the database rather than the code.
 *
 * Every rule below was enforced only by application code before the backend
 * existed, and several were enforced inconsistently or not at all — a quote from
 * an unrelated requirement could be selected, a lead's status went stale after
 * four different mutations, a vendor could be assigned twice. The fix in each
 * case was to make the violation unrepresentable, so the test has to attempt the
 * violation and watch Postgres refuse it. A test that went through the service
 * function would pass just as happily in the state that produced those bugs.
 */
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { maybe, maybeAll, needs, one, refusedBy, rollingBack } from "./helpers/harness";

let leadId: string;
let leadDomainId: string;
let clientId: string;
let professionalId: string;

beforeAll(async () => {
  const lead = await one<{ id: string; client_id: string }>(
    `SELECT id, client_id FROM leads ORDER BY reference LIMIT 1`,
  );
  leadId = lead.id;
  clientId = lead.client_id;
  leadDomainId = (
    await one<{ id: string }>(`SELECT id FROM lead_domains WHERE lead_id = '${leadId}' LIMIT 1`)
  ).id;
  professionalId = (await one<{ id: string }>(`SELECT id FROM professionals LIMIT 1`)).id;
});

describe("one of a kind", () => {
  test("a service cannot have two projects", async () => {
    const existing = await one<{ lead_domain_id: string }>(
      `SELECT lead_domain_id FROM projects WHERE deleted_at IS NULL LIMIT 1`,
    );
    await refusedBy("uq_project_lead_domain", (tx) =>
      tx.execute(sql`
        INSERT INTO projects
          (lead_domain_id, reference, agreement_id, client_id, professional_id, quote_id,
           value, commission_percent, commission_amount, status)
        SELECT lead_domain_id, 'PRJ-TEST', agreement_id, client_id, professional_id, quote_id,
               value, commission_percent, commission_amount, status
        FROM projects WHERE lead_domain_id = ${existing.lead_domain_id}
      `),
    );
  });

  test("an agreement cannot be invoiced twice", async () => {
    const invoice = await one<{ agreement_id: string }>(
      `SELECT agreement_id FROM commission_invoices LIMIT 1`,
    );
    await refusedBy("uq_invoice_agreement", (tx) =>
      tx.execute(sql`
        INSERT INTO commission_invoices
          (agreement_id, reference, professional_id, amount, status, due_date)
        SELECT agreement_id, 'INV-TEST', professional_id, amount, status, due_date
        FROM commission_invoices WHERE agreement_id = ${invoice.agreement_id}
      `),
    );
  });

  test("a project cannot be reviewed twice", async (ctx) => {
    const review = await maybe<{ project_id: string }>(`SELECT project_id FROM reviews LIMIT 1`);
    needs(ctx, review, "a reviewed project");
    await refusedBy("uq_review_project", (tx) =>
      tx.execute(sql`
        INSERT INTO reviews (project_id, client_id, professional_id, domain_id, rating, comment)
        SELECT project_id, client_id, professional_id, domain_id, rating, comment
        FROM reviews WHERE project_id = ${review.project_id}
      `),
    );
  });

  test("a vendor cannot be assigned to the same service twice", async () => {
    const first = await one<{ lead_domain_id: string; professional_id: string }>(
      `SELECT lead_domain_id, professional_id FROM lead_domain_assignments LIMIT 1`,
    );
    await refusedBy("uq_assignment", (tx) =>
      tx.execute(sql`
        INSERT INTO lead_domain_assignments (lead_domain_id, professional_id, response_status)
        VALUES (${first.lead_domain_id}, ${first.professional_id}, 'pending')
      `),
    );
  });

  test("a vendor cannot hold two live quotes for one service", async () => {
    const live = await one<{ lead_domain_id: string; professional_id: string }>(
      `SELECT lead_domain_id, professional_id FROM quotes
       WHERE status NOT IN ('revised', 'rejected') LIMIT 1`,
    );
    await refusedBy("uq_quote_live", (tx) =>
      tx.execute(sql`
        INSERT INTO quotes
          (lead_domain_id, professional_id, version, status, line_items, subtotal, total, timeline_days)
        VALUES (${live.lead_domain_id}, ${live.professional_id}, 99, 'submitted',
                '[]'::jsonb, 1000, 1000, 14)
      `),
    );
  });

  test("quote versions cannot collide", async () => {
    const q = await one<{ lead_domain_id: string; professional_id: string; version: number }>(
      `SELECT lead_domain_id, professional_id, version FROM quotes LIMIT 1`,
    );
    await refusedBy("uq_quote_version", (tx) =>
      tx.execute(sql`
        INSERT INTO quotes
          (lead_domain_id, professional_id, version, status, line_items, subtotal, total, timeline_days)
        VALUES (${q.lead_domain_id}, ${q.professional_id}, ${q.version}, 'revised',
                '[]'::jsonb, 1000, 1000, 14)
      `),
    );
  });

  test("a vendor cannot hold two live partner agreements", async () => {
    const live = await one<{ professional_id: string; terms_version: string }>(
      `SELECT professional_id, terms_version FROM partner_agreements
       WHERE status <> 'superseded' LIMIT 1`,
    );
    await refusedBy("uq_partner_agreement_live", (tx) =>
      tx.execute(sql`
        INSERT INTO partner_agreements
          (professional_id, terms_version, status, signatory_name, signed_from_ip)
        VALUES (${live.professional_id}, ${live.terms_version}, 'signed', 'Test', '127.0.0.1')
      `),
    );
  });
});

describe("the client/vendor firewall", () => {
  /**
   * The rule the commercial model rests on: a customer and a vendor never hold
   * each other's contact details, and every message goes through the platform.
   * As a check constraint, a future handler cannot quietly open a direct channel
   * by passing the wrong pair of arguments.
   */
  test("a message on the client channel cannot name a vendor", async () => {
    await refusedBy("ck_message_channel", (tx) =>
      tx.execute(sql`
        INSERT INTO messages (lead_domain_id, channel, sender_role, sender_id, professional_id, body)
        VALUES (${leadDomainId}, 'client_platform', 'client', ${clientId}, ${professionalId}, 'hello')
      `),
    );
  });

  test("a vendor cannot post into the client thread", async () => {
    await refusedBy("ck_message_channel", (tx) =>
      tx.execute(sql`
        INSERT INTO messages (lead_domain_id, channel, sender_role, sender_id, professional_id, body)
        VALUES (${leadDomainId}, 'client_platform', 'professional', ${professionalId}, NULL, 'hello')
      `),
    );
  });

  test("a vendor-channel message must name its vendor", async () => {
    await refusedBy("ck_message_channel", (tx) =>
      tx.execute(sql`
        INSERT INTO messages (lead_domain_id, channel, sender_role, sender_id, professional_id, body)
        VALUES (${leadDomainId}, 'platform_vendor', 'platform', ${clientId}, NULL, 'hello')
      `),
    );
  });
});

describe("a selected quote belongs to the service that selected it", () => {
  /**
   * A real defect: `selectQuote` took a quote id and wrote it without checking
   * it belonged to the service being updated, so a quote from an unrelated
   * requirement could be selected — carrying its price, its vendor and its
   * commission. The composite foreign key makes that unrepresentable.
   */
  test("a quote from another service cannot be selected", async (ctx) => {
    // A service with no vendor chosen yet, so the composite foreign key is the
    // first rule the write meets. On a service that already has one, the vendor
    // trigger fires first — also a refusal, but not the one under test here.
    const open = await one<{ id: string }>(
      `SELECT id FROM lead_domains WHERE selected_professional_id IS NULL LIMIT 1`,
    );
    // The quote's own vendor is set alongside it, so the vendor trigger is
    // satisfied and the foreign key is what is left to refuse the write. Set
    // only the quote and the trigger catches it first — a refusal either way,
    // but then the test would not be exercising the key it names.
    const foreign = await maybe<{ id: string; professional_id: string }>(
      `SELECT q.id, q.professional_id FROM quotes q WHERE q.lead_domain_id <> '${open.id}' LIMIT 1`,
    );
    needs(ctx, foreign, "a quote on another service");

    await refusedBy("fk_lead_domain_selected_quote", (tx) =>
      tx.execute(sql`
        UPDATE lead_domains
        SET selected_quote_id = ${foreign.id}, selected_professional_id = ${foreign.professional_id}
        WHERE id = ${open.id}
      `),
    );
  });

  test("the recorded vendor must be the vendor whose quote won", async () => {
    const quote = await one<{ id: string; lead_domain_id: string; professional_id: string }>(
      `SELECT id, lead_domain_id, professional_id FROM quotes LIMIT 1`,
    );
    const other = await one<{ id: string }>(
      `SELECT id FROM professionals WHERE id <> '${quote.professional_id}' LIMIT 1`,
    );

    await refusedBy("quote", (tx) =>
      tx.execute(sql`
        UPDATE lead_domains
        SET selected_quote_id = ${quote.id}, selected_professional_id = ${other.id}
        WHERE id = ${quote.lead_domain_id}
      `),
    );
  });
});

describe("derived values are actually derived", () => {
  /**
   * `leads.overall_status` was documented as derived and recomputed by only
   * three of the seven mutations that could change it. These tests write to the
   * underlying table directly — the way a future mutation by somebody who has
   * not read this file would — and assert the derived value moved anyway.
   */
  test("completing every service closes the lead, with nobody recomputing it", async () => {
    const target = await one<{ lead_id: string }>(
      `SELECT ld.lead_id FROM lead_domains ld
       JOIN leads l ON l.id = ld.lead_id
       WHERE l.overall_status <> 'closed' AND l.deleted_at IS NULL LIMIT 1`,
    );

    await rollingBack(async (tx) => {
      await tx.execute(sql`
        UPDATE lead_domains SET status = 'completed' WHERE lead_id = ${target.lead_id}
      `);
      const [lead] = (await tx.execute(sql`
        SELECT overall_status FROM leads WHERE id = ${target.lead_id}
      `)) as unknown as Array<{ overall_status: string }>;
      expect(lead!.overall_status).toBe("closed");
    });
  });

  test("project completion follows approved milestones, not a written number", async (ctx) => {
    const project = await maybe<{ id: string }>(
      `SELECT p.id FROM projects p
       JOIN project_milestones m ON m.project_id = p.id
       GROUP BY p.id
       HAVING count(*) FILTER (WHERE m.verification <> 'approved') > 0
       LIMIT 1`,
    );
    needs(ctx, project, "a project with unapproved milestones");

    await rollingBack(async (tx) => {
      await tx.execute(sql`
        UPDATE project_milestones SET verification = 'approved', verified_at = now()
        WHERE project_id = ${project.id}
      `);
      const [row] = (await tx.execute(sql`
        SELECT completion_percent FROM projects WHERE id = ${project.id}
      `)) as unknown as Array<{ completion_percent: number }>;
      expect(Number(row!.completion_percent)).toBe(100);
    });
  });

  /**
   * The cached rating is recomputed from the reviews table, not incremented —
   * which is what stops it drifting from what it summarises. Note that the seed
   * ships fabricated counts that no review row backs, so this asserts the rule
   * (the cache equals the reviews) rather than an increment on the old number.
   */
  test("a review recomputes the vendor's cached rating from the reviews themselves", async (ctx) => {
    const target = await maybe<{
      project_id: string;
      professional_id: string;
      domain_id: string;
      client_id: string;
    }>(
      `SELECT p.id AS project_id, p.professional_id, ld.domain_id, p.client_id
       FROM projects p
       JOIN lead_domains ld ON ld.id = p.lead_domain_id
       WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.project_id = p.id)
       LIMIT 1`,
    );
    needs(ctx, target, "an unreviewed project");

    await rollingBack(async (tx) => {
      await tx.execute(sql`
        INSERT INTO reviews (project_id, client_id, professional_id, domain_id, rating, comment)
        VALUES (${target.project_id}, ${target.client_id}, ${target.professional_id},
                ${target.domain_id}, 5, 'Excellent work throughout.')
      `);

      const [after] = (await tx.execute(sql`
        SELECT pd.rating_count, pd.avg_rating_x10,
               (SELECT count(*) FROM reviews r
                WHERE r.professional_id = pd.professional_id
                  AND r.domain_id = pd.domain_id
                  AND r.deleted_at IS NULL) AS actual
        FROM professional_domains pd
        WHERE pd.professional_id = ${target.professional_id}
          AND pd.domain_id = ${target.domain_id}
      `)) as unknown as Array<{ rating_count: number; avg_rating_x10: number; actual: number }>;

      expect(Number(after!.rating_count)).toBe(Number(after!.actual));
      expect(Number(after!.rating_count)).toBeGreaterThan(0);
    });
  });
});

describe("references", () => {
  test("lead references are unique", async () => {
    const lead = await one<{ reference: string }>(`SELECT reference FROM leads LIMIT 1`);
    await refusedBy("uq_lead_reference", (tx) =>
      tx.execute(sql`
        INSERT INTO leads (reference, client_id, city_id, description, urgency)
        SELECT ${lead.reference}, client_id, city_id, description, urgency
        FROM leads WHERE reference = ${lead.reference}
      `),
    );
  });

  /**
   * The old generators counted rows, so two submissions in the same second
   * produced the same "LD-1042" — a number the customer is told to quote back.
   * A sequence cannot, and deliberately does not roll back with the transaction,
   * which is the property that makes it safe under concurrency.
   */
  test("two leads created back to back get different references", async () => {
    await rollingBack(async (tx) => {
      const insert = () =>
        tx.execute(sql`
          INSERT INTO leads (reference, client_id, city_id, description, urgency)
          SELECT 'LD-' || nextval('lead_reference_seq'), client_id, city_id, 'test', urgency
          FROM leads LIMIT 1
          RETURNING reference
        `) as unknown as Promise<Array<{ reference: string }>>;

      const [first] = await insert();
      const [second] = await insert();
      expect(first!.reference).not.toBe(second!.reference);
    });
  });
});

describe("the seed is consistent with itself", () => {
  /**
   * The mock data carried hand-written rating counts — one vendor claimed 201
   * reviews against two review rows in the whole platform. Nothing recomputed
   * them on load, so they sat there looking authoritative and would have
   * collapsed to the real number the first time a genuine customer reviewed
   * anybody. A cached value the database also derives has to start out agreeing
   * with the derivation, or it is just a number waiting to change on its own.
   */
  test("every cached rating matches the reviews behind it", async () => {
    const drift = (await maybeAll<{ company_name: string; cached: number; actual: number }>(
      `SELECT p.company_name, p.rating_count AS cached,
              (SELECT count(*) FROM reviews r
               WHERE r.professional_id = p.id AND r.deleted_at IS NULL) AS actual
       FROM professionals p
       WHERE p.rating_count <> (
         SELECT count(*) FROM reviews r
         WHERE r.professional_id = p.id AND r.deleted_at IS NULL
       )`,
    ));

    expect(
      drift.map((d) => `${d.company_name}: shows ${d.cached}, has ${d.actual}`).join("; "),
    ).toBe("");
  });

  test("every completed-project count matches the projects behind it", async () => {
    const drift = await maybeAll<{ company_name: string }>(
      `SELECT p.company_name FROM professionals p
       WHERE p.completed_projects <> (
         SELECT count(*) FROM projects pr
         WHERE pr.professional_id = p.id AND pr.status = 'completed' AND pr.deleted_at IS NULL
       )`,
    );
    expect(drift.map((d) => d.company_name).join(", ")).toBe("");
  });
});

describe("the call log stays attributable", () => {
  test("an activity naming neither an agent nor a user is refused", async () => {
    await refusedBy("ck_activity_attributed", (tx) =>
      tx.execute(sql`
        INSERT INTO lead_sales_activities (lead_id, sales_agent_id, logged_by_user_id, call_status)
        VALUES (${leadId}, NULL, NULL, 'connected')
      `),
    );
  });
});
