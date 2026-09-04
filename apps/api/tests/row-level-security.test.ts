/**
 * The layer underneath the scoped repository.
 *
 * `getLead` and `getAgreement` once checked that a record existed but not that
 * it belonged to the caller. The repository is careful about that now and the
 * authorisation tests hold it there — but "the query author remembered" is the
 * same assurance that failed the first time. These policies mean that a query
 * written without its `WHERE` returns nothing rather than somebody else's
 * requirement.
 *
 * The test that matters is the last kind: a *deliberately unscoped* query,
 * issued inside a customer's scope, asking for everything. Under the policies
 * it comes back with only their own rows. Without them it would return the lot,
 * which is precisely the bug being defended against.
 */
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { db, unscopedDb } from "../src/db/client";
import { withActor } from "../src/db/actor-context";
import { app, one, otpSession } from "./helpers/harness";

let customer: { userId: string; clientId: string; mobile: string };
let vendor: { userId: string; professionalId: string; mobile: string };
let totalLeads: number;

beforeAll(async () => {
  const c = await one<{ user_id: string; client_id: string; mobile: string }>(
    `SELECT u.id AS user_id, c.id AS client_id, u.mobile
     FROM clients c JOIN users u ON u.id = c.user_id
     JOIN leads l ON l.client_id = c.id
     GROUP BY u.id, c.id, u.mobile LIMIT 1`,
  );
  customer = { userId: c.user_id, clientId: c.client_id, mobile: c.mobile };

  const v = await one<{ user_id: string; professional_id: string; mobile: string }>(
    `SELECT u.id AS user_id, p.id AS professional_id, u.mobile
     FROM professionals p JOIN users u ON u.id = p.user_id
     JOIN lead_domain_assignments a ON a.professional_id = p.id
     GROUP BY u.id, p.id, u.mobile LIMIT 1`,
  );
  vendor = { userId: v.user_id, professionalId: v.professional_id, mobile: v.mobile };

  const [row] = (await unscopedDb.execute(sql`
    SELECT count(*)::int AS n FROM leads WHERE deleted_at IS NULL
  `)) as unknown as Array<{ n: number }>;
  totalLeads = row!.n;
});

describe("without an actor, nothing is hidden", () => {
  /**
   * Ops read across every customer, and the jobs, migrations and seed have no
   * actor at all. If the policies bit here, none of them would work.
   */
  test("the pool still sees every lead", async () => {
    const [row] = (await unscopedDb.execute(sql`
      SELECT count(*)::int AS n FROM leads WHERE deleted_at IS NULL
    `)) as unknown as Array<{ n: number }>;
    expect(row!.n).toBe(totalLeads);
    expect(totalLeads).toBeGreaterThan(1);
  });
});

describe("inside a customer's scope", () => {
  test("an unscoped query returns only their own leads", async () => {
    await withActor({ userId: customer.userId, clientId: customer.clientId }, async () => {
      // Deliberately no WHERE on client_id. This is the mistake being defended
      // against, written out on purpose.
      const rows = (await db.execute(sql`
        SELECT id, client_id FROM leads WHERE deleted_at IS NULL
      `)) as unknown as Array<{ client_id: string }>;

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThan(totalLeads);
      expect(rows.every((r) => r.client_id === customer.clientId)).toBe(true);
    });
  });

  test("another customer's messages are not readable", async () => {
    // Asserted from the other side: the seed's message threads all belong to
    // one customer, so the test signs in as a different one and checks the
    // whole table reads as empty. Looking for a specific foreign message would
    // need a fixture the seed does not have.
    const outsider = await one<{ user_id: string; client_id: string }>(
      `SELECT u.id AS user_id, c.id AS client_id
       FROM clients c JOIN users u ON u.id = c.user_id
       WHERE c.id <> (
         SELECT l.client_id FROM messages m
         JOIN lead_domains ld ON ld.id = m.lead_domain_id
         JOIN leads l ON l.id = ld.lead_id LIMIT 1
       )
       LIMIT 1`,
    );

    const [{ n: everything }] = (await unscopedDb.execute(sql`
      SELECT count(*)::int AS n FROM messages
    `)) as unknown as Array<{ n: number }>;
    expect(everything, "the seed has no messages, so this proves nothing").toBeGreaterThan(0);

    await withActor({ userId: outsider.user_id, clientId: outsider.client_id }, async () => {
      const rows = (await db.execute(sql`
        SELECT id FROM messages
      `)) as unknown as Array<{ id: string }>;
      expect(rows, "a customer could read another customer's thread").toHaveLength(0);
    });
  });

  test("no commission invoice is visible at all", async () => {
    await withActor({ userId: customer.userId, clientId: customer.clientId }, async () => {
      const rows = (await db.execute(sql`
        SELECT id FROM commission_invoices
      `)) as unknown as Array<{ id: string }>;
      expect(rows, "a customer could see what a vendor is charged").toHaveLength(0);
    });
  });
});

describe("inside a vendor's scope", () => {
  test("only leads they are assigned to are visible", async () => {
    await withActor(
      { userId: vendor.userId, professionalId: vendor.professionalId },
      async () => {
        const rows = (await db.execute(sql`
          SELECT id FROM leads WHERE deleted_at IS NULL
        `)) as unknown as Array<{ id: string }>;

        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThan(totalLeads);
      },
    );
  });

  test("another vendor's quotes on the same job are not readable", async () => {
    const rival = await one<{ id: string }>(
      `SELECT q.id FROM quotes q WHERE q.professional_id <> '${vendor.professionalId}' LIMIT 1`,
    );

    await withActor(
      { userId: vendor.userId, professionalId: vendor.professionalId },
      async () => {
        const rows = (await db.execute(sql`
          SELECT id FROM quotes WHERE id = ${rival.id}
        `)) as unknown as Array<{ id: string }>;
        expect(rows, "a vendor could read a competitor's price").toHaveLength(0);
      },
    );
  });

  test("another vendor's invoices are not readable", async () => {
    await withActor(
      { userId: vendor.userId, professionalId: vendor.professionalId },
      async () => {
        const rows = (await db.execute(sql`
          SELECT professional_id FROM commission_invoices
        `)) as unknown as Array<{ professional_id: string }>;
        expect(rows.every((r) => r.professional_id === vendor.professionalId)).toBe(true);
      },
    );
  });
});

describe("the users table", () => {
  /**
   * Where the phone numbers and email addresses actually live. The masking
   * layer decides what a vendor is shown *from* a row; this decides which rows
   * exist, which is the part that survives somebody writing a new query without
   * having read the masking file.
   */
  test("a customer cannot read another customer's user row", async () => {
    const stranger = await one<{ id: string; name: string }>(
      `SELECT u.id, u.name FROM users u
       JOIN clients c ON c.user_id = u.id
       WHERE c.id <> '${customer.clientId}'
         AND NOT EXISTS (
           SELECT 1 FROM referrals r
           WHERE (r.referred_user_id = u.id AND r.referrer_user_id = '${customer.userId}')
              OR (r.referrer_user_id = u.id AND r.referred_user_id = '${customer.userId}')
         )
       LIMIT 1`,
    );

    await withActor({ userId: customer.userId, clientId: customer.clientId }, async () => {
      const rows = (await db.execute(sql`
        SELECT id FROM users WHERE id = ${stranger.id}
      `)) as unknown as unknown[];
      expect(rows, `another customer's user row was readable`).toHaveLength(0);
    });
  });

  test("a vendor reads the customers they work for, and no others", async () => {
    await withActor(
      { userId: vendor.userId, professionalId: vendor.professionalId },
      async () => {
        const rows = (await db.execute(sql`
          SELECT u.id FROM users u JOIN clients c ON c.user_id = u.id
        `)) as unknown as unknown[];

        const [{ n: served }] = (await unscopedDb.execute(sql`
          SELECT count(DISTINCT l.client_id)::int AS n
          FROM leads l
          JOIN lead_domains ld ON ld.lead_id = l.id
          JOIN lead_domain_assignments a ON a.lead_domain_id = ld.id
          WHERE a.professional_id = ${vendor.professionalId}
        `)) as unknown as Array<{ n: number }>;

        const [{ n: everyone }] = (await unscopedDb.execute(sql`
          SELECT count(*)::int AS n FROM clients
        `)) as unknown as Array<{ n: number }>;

        expect(rows.length).toBe(served);
        expect(served, "this vendor serves every customer, so this proves nothing").toBeLessThan(
          everyone,
        );
      },
    );
  });

  test("everyone can still read vendors — the directory is public", async () => {
    await withActor({ userId: customer.userId, clientId: customer.clientId }, async () => {
      const rows = (await db.execute(sql`
        SELECT u.id FROM users u JOIN professionals p ON p.user_id = u.id
      `)) as unknown as unknown[];
      expect(rows.length, "the vendor directory disappeared for a signed-in customer")
        .toBeGreaterThan(1);
    });
  });
});

describe("the connection is not left carrying an identity", () => {
  /**
   * The settings are session-scoped, so a connection returned to the pool still
   * holding somebody's id would silently apply their policies to whoever picked
   * it up next — a data leak dressed as a performance optimisation.
   */
  test("the settings are cleared when the scope closes", async () => {
    await withActor({ userId: customer.userId, clientId: customer.clientId }, async () => {
      const [row] = (await db.execute(sql`
        SELECT current_setting('app.client_id', true) AS value
      `)) as unknown as Array<{ value: string }>;
      expect(row!.value).toBe(customer.clientId);
    });

    // Every connection in the pool, checked one after another.
    for (let i = 0; i < 4; i += 1) {
      const [row] = (await unscopedDb.execute(sql`
        SELECT coalesce(current_setting('app.client_id', true), '') AS value
      `)) as unknown as Array<{ value: string }>;
      expect(row!.value).toBe("");
    }
  });
});

describe("the personal surfaces still work with the policies on", () => {
  /**
   * The risk with row-level security is not that it fails open, it is that it
   * fails closed and silently — a screen that used to show six requirements
   * shows none, and nothing errors. So the endpoints are exercised through
   * HTTP, where the hooks are actually in play.
   */
  test("a customer still sees their own requirements", async () => {
    const instance = await app();
    const cookie = await otpSession(customer.mobile);

    const response = await instance.inject({
      method: "GET",
      url: "/me/requirements",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<unknown>();
    const items = Array.isArray(payload)
      ? payload
      : ((payload as { items?: unknown[] }).items ?? []);
    expect(items.length, "the policies hid the customer's own requirements").toBeGreaterThan(0);
  });

  test("a vendor still sees their own leads", async () => {
    const instance = await app();
    const cookie = await otpSession(vendor.mobile);

    const response = await instance.inject({
      method: "GET",
      url: "/vendor/leads",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<unknown>();
    const items = Array.isArray(payload)
      ? payload
      : ((payload as { items?: unknown[] }).items ?? []);
    expect(items.length, "the policies hid the vendor's own leads").toBeGreaterThan(0);
  });
});
