/**
 * Every personal screen, asserted to still return the person's own data.
 *
 * This is the counterpart to the masking sweep, and it exists because the two
 * failure modes are opposite. Masking fails *open* — a phone number appears
 * where it should not, and the sweep greps for it. Row-level security fails
 * *closed* — a policy is slightly too strict, a screen that showed six
 * requirements shows none, nothing errors and nothing logs. That failure is
 * invisible to every other test in this suite, including the sweep, which
 * tolerates a non-200 and would tolerate an empty list.
 *
 * So each endpoint below is asserted to answer 200 *and* to contain something,
 * where the seed has something for it to contain. Anywhere the seed is empty
 * the test says so out loud rather than passing quietly.
 */
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { unscopedDb } from "../src/db/client";
import { app, one, otpSession } from "./helpers/harness";

let customer: string;
let vendor: string;
let customerUserId: string;
let clientId: string;
let professionalId: string;

/** How many rows the seed actually holds, read without any policy in the way. */
async function count(query: string): Promise<number> {
  const [row] = (await unscopedDb.execute(sql.raw(query))) as unknown as Array<{ n: number }>;
  return Number(row?.n ?? 0);
}

beforeAll(async () => {
  const c = await one<{ mobile: string; user_id: string; client_id: string }>(
    `SELECT u.mobile, u.id AS user_id, c.id AS client_id
     FROM clients c JOIN users u ON u.id = c.user_id
     JOIN leads l ON l.client_id = c.id
     GROUP BY u.mobile, u.id, c.id
     ORDER BY count(l.id) DESC
     LIMIT 1`,
  );
  customer = await otpSession(c.mobile);
  customerUserId = c.user_id;
  clientId = c.client_id;

  const v = await one<{ mobile: string; id: string }>(
    `SELECT u.mobile, p.id
     FROM professionals p JOIN users u ON u.id = p.user_id
     JOIN lead_domain_assignments a ON a.professional_id = p.id
     WHERE p.verification_status = 'verified'
     GROUP BY u.mobile, p.id
     ORDER BY count(a.id) DESC
     LIMIT 1`,
  );
  vendor = await otpSession(v.mobile);
  professionalId = v.id;
});

/**
 * The rows in a response, whatever shape it came in.
 *
 * These endpoints answer variously with a bare array, a paged `{ items }`
 * envelope, or an object naming its own collection (`{ code, referrals }`).
 * Guessing one shape made this test fail on an endpoint that was working
 * perfectly, so it takes the longest array it can find instead.
 */
function rowsIn(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];

  const arrays = Object.values(body as Record<string, unknown>).filter(Array.isArray);
  return arrays.sort((a, b) => b.length - a.length)[0] ?? [];
}

describe("a customer still sees their own everything", () => {
  const screens: Array<[string, () => Promise<number>]> = [
    ["/me/requirements", () => count(`SELECT count(*) AS n FROM leads WHERE client_id = '${clientId}' AND deleted_at IS NULL`)],
    ["/me/agreements", () => count(`SELECT count(*) AS n FROM agreements a JOIN leads l ON l.id = a.lead_id WHERE l.client_id = '${clientId}'`)],
    ["/me/projects", () => count(`SELECT count(*) AS n FROM projects WHERE client_id = '${clientId}' AND deleted_at IS NULL`)],
    ["/me/notifications", () => count(`SELECT count(*) AS n FROM notifications WHERE user_id = '${customerUserId}'`)],
    ["/me/tickets", () => count(`SELECT count(*) AS n FROM support_tickets WHERE raised_by_user_id = '${customerUserId}' AND deleted_at IS NULL`)],
    ["/me/referrals", () => count(`SELECT count(*) AS n FROM referrals WHERE referrer_user_id = '${customerUserId}'`)],
  ];

  test.each(screens)("%s", async (url, expected) => {
    const instance = await app();
    const response = await instance.inject({ method: "GET", url, headers: { cookie: customer } });

    expect(response.statusCode, `${url} answered ${response.statusCode}: ${response.body}`).toBe(
      200,
    );

    const seeded = await expected();
    if (seeded === 0) {
      // Honest rather than green: the endpoint works, but nothing was proved
      // about whether the policies let real rows through.
      console.warn(`  ${url}: the seed has no rows, so this only checked the status code`);
      return;
    }

    expect(
      rowsIn(response.json()).length,
      `${url} returned nothing, but the customer has ${seeded} — a policy is too strict`,
    ).toBeGreaterThan(0);
  });

  test("one requirement, in full, including its services and messages", async () => {
    const instance = await app();
    const lead = await one<{ id: string }>(
      `SELECT id FROM leads WHERE client_id = '${clientId}' AND deleted_at IS NULL LIMIT 1`,
    );

    const response = await instance.inject({
      method: "GET",
      url: `/me/requirements/${lead.id}`,
      headers: { cookie: customer },
    });

    expect(response.statusCode, response.body).toBe(200);
    const body = response.json<{ domains?: unknown[] }>();
    expect(
      (body.domains ?? []).length,
      "the requirement came back with no services — lead_domains is over-filtered",
    ).toBeGreaterThan(0);
  });

  test("the message thread on their own service", async () => {
    const service = await one<{ id: string }>(
      `SELECT ld.id FROM lead_domains ld
       JOIN leads l ON l.id = ld.lead_id
       JOIN messages m ON m.lead_domain_id = ld.id
       WHERE l.client_id = '${clientId}' AND m.channel = 'client_platform'
       LIMIT 1`,
    );

    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/me/services/${service.id}/messages`,
      headers: { cookie: customer },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(
      rowsIn(response.json()).length,
      "the customer's own thread came back empty",
    ).toBeGreaterThan(0);
  });
});

describe("a vendor still sees their own everything", () => {
  const screens: Array<[string, () => Promise<number>]> = [
    ["/vendor/leads", () => count(`SELECT count(*) AS n FROM lead_domain_assignments WHERE professional_id = '${professionalId}' AND deleted_at IS NULL`)],
    ["/vendor/agreements", () => count(`SELECT count(*) AS n FROM agreements WHERE professional_id = '${professionalId}'`)],
    ["/vendor/projects", () => count(`SELECT count(*) AS n FROM projects WHERE professional_id = '${professionalId}' AND deleted_at IS NULL`)],
    ["/vendor/invoices", () => count(`SELECT count(*) AS n FROM commission_invoices WHERE professional_id = '${professionalId}' AND deleted_at IS NULL`)],
    ["/vendor/visits", () => count(`SELECT count(*) AS n FROM meetings WHERE professional_id = '${professionalId}' AND deleted_at IS NULL`)],
    ["/vendor/portfolio", () => count(`SELECT count(*) AS n FROM portfolio_items WHERE professional_id = '${professionalId}' AND deleted_at IS NULL`)],
  ];

  test.each(screens)("%s", async (url, expected) => {
    const instance = await app();
    const response = await instance.inject({ method: "GET", url, headers: { cookie: vendor } });

    expect(response.statusCode, `${url} answered ${response.statusCode}: ${response.body}`).toBe(
      200,
    );

    const seeded = await expected();
    if (seeded === 0) {
      console.warn(`  ${url}: the seed has no rows, so this only checked the status code`);
      return;
    }

    expect(
      rowsIn(response.json()).length,
      `${url} returned nothing, but the vendor has ${seeded} — a policy is too strict`,
    ).toBeGreaterThan(0);
  });

  test("the dashboard and the onboarding checklist are readable", async () => {
    const instance = await app();
    for (const url of ["/vendor/dashboard", "/vendor/onboarding", "/vendor/performance"]) {
      const response = await instance.inject({ method: "GET", url, headers: { cookie: vendor } });
      expect(response.statusCode, `${url} answered ${response.statusCode}: ${response.body}`).toBe(
        200,
      );
      expect(response.body.length, `${url} came back empty`).toBeGreaterThan(2);
    }
  });

  test("their own partner agreement is still visible to them", async () => {
    const signed = await count(
      `SELECT count(*) AS n FROM partner_agreements WHERE professional_id = '${professionalId}'`,
    );
    expect(signed, "the seed has no partner agreement for this vendor").toBeGreaterThan(0);

    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: "/vendor/onboarding",
      headers: { cookie: vendor },
    });

    expect(response.statusCode).toBe(200);
    // The checklist is built from the agreement, so an over-strict policy shows
    // a signed vendor as unsigned — and quietly takes them out of every pool.
    expect(response.body).toMatch(/agreement/i);
  });

  test("one lead in full, with the items the customer chose", async () => {
    const service = await one<{ id: string }>(
      `SELECT a.lead_domain_id AS id FROM lead_domain_assignments a
       WHERE a.professional_id = '${professionalId}' LIMIT 1`,
    );

    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/vendor/leads/${service.id}`,
      headers: { cookie: vendor },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.body.length).toBeGreaterThan(50);
  });
});

describe("the internal record stays internal", () => {
  /**
   * The call log is what an agent wrote down about a customer after a phone
   * call. Neither the customer it describes nor the vendor working the job has
   * any business reading it.
   */
  test("neither party can read the call log", async () => {
    const logged = await count(`SELECT count(*) AS n FROM lead_sales_activities`);
    expect(logged, "the seed has no call log, so this proves nothing").toBeGreaterThan(0);

    const { withActor } = await import("../src/db/actor-context");
    const { db } = await import("../src/db/client");

    for (const actor of [
      { userId: customerUserId, clientId },
      { userId: customerUserId, professionalId },
    ]) {
      await withActor(actor, async () => {
        const rows = (await db.execute(sql`
          SELECT id FROM lead_sales_activities
        `)) as unknown as unknown[];
        expect(rows, "the call log was readable inside a customer's request").toHaveLength(0);
      });
    }
  });

  test("the sessions table is not readable beyond one's own", async () => {
    const { withActor } = await import("../src/db/actor-context");
    const { db } = await import("../src/db/client");

    const total = await count(`SELECT count(*) AS n FROM sessions`);
    expect(total).toBeGreaterThan(1);

    await withActor({ userId: customerUserId, clientId }, async () => {
      const rows = (await db.execute(sql`
        SELECT user_id FROM sessions
      `)) as unknown as Array<{ user_id: string }>;
      expect(rows.every((r) => r.user_id === customerUserId)).toBe(true);
    });
  });

  test("staff credentials and the audit trail are invisible", async () => {
    const { withActor } = await import("../src/db/actor-context");
    const { db } = await import("../src/db/client");

    expect(await count(`SELECT count(*) AS n FROM staff_credentials`)).toBeGreaterThan(0);

    await withActor({ userId: customerUserId, clientId }, async () => {
      for (const table of ["staff_credentials", "audit_logs", "otp_challenges", "rate_limits"]) {
        const rows = (await db.execute(
          sql.raw(`SELECT 1 FROM ${table}`),
        )) as unknown as unknown[];
        expect(rows, `${table} was readable inside a customer's request`).toHaveLength(0);
      }
    });
  });
});
