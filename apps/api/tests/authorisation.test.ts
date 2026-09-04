/**
 * Who can do what, and whose data they can reach.
 *
 * Three separate controls, all previously enforced only by convention:
 *
 *   - **Ownership.** `getLead` and `getAgreement` checked that a record existed,
 *     not that it belonged to the caller. Any signed-in customer could read any
 *     other customer's requirement by guessing an id.
 *   - **Permissions.** `AdminRole.permissions` was in the model and nothing read
 *     it, so a sales agent could waive an invoice.
 *   - **Eligibility.** Assignment trusted the pool it was handed rather than
 *     re-checking, so a vendor who had not signed could be assigned by posting
 *     their id directly.
 *
 * Each is tested by trying it as the wrong person, not by reading the code.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { app, maybe, needs, one, otpSession, staffSession } from "./helpers/harness";

let admin: string;
let agent: string;
let customerA: string;
let customerBLeadId: string;
let customerBAgreementId: string;

beforeAll(async () => {
  admin = await staffSession("admin@example.com");
  agent = await staffSession("kavita@example.com");

  // Customer B is chosen as somebody who has a lead *and* an agreement, so both
  // ownership checks have a real record to be refused. Customer A is anyone
  // else. Picking B at random left the agreement test with nothing to try.
  const pair = await one<{ mobile_a: string; lead_b: string; agreement_b: string }>(
    `SELECT ua.mobile AS mobile_a, lb.id AS lead_b, ab.id AS agreement_b
     FROM agreements ab
     JOIN leads lb ON lb.id = ab.lead_id
     JOIN clients ca ON ca.id <> lb.client_id
     JOIN users ua ON ua.id = ca.user_id
     WHERE ua.mobile IS NOT NULL
     LIMIT 1`,
  );
  customerA = await otpSession(pair.mobile_a);
  customerBLeadId = pair.lead_b;
  customerBAgreementId = pair.agreement_b;
});

describe("a customer reaches only their own records", () => {
  test("someone else's requirement is not readable", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/me/requirements/${customerBLeadId}`,
      headers: { cookie: customerA },
    });

    // 404 rather than 403 is the better answer — a 403 confirms the id exists.
    expect([403, 404]).toContain(response.statusCode);
  });

  test("someone else's agreement is not readable", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/me/agreements/${customerBAgreementId}`,
      headers: { cookie: customerA },
    });
    expect([403, 404]).toContain(response.statusCode);
  });

  test("signed out, nothing personal is readable at all", async () => {
    const instance = await app();
    const response = await instance.inject({ method: "GET", url: "/me/requirements" });
    expect(response.statusCode).toBe(401);
  });
});

describe("staff permissions are enforced, not documented", () => {
  /**
   * A sales agent works leads all day. They should not be able to change a
   * commission rate, write off an invoice, or verify a vendor — those are
   * different jobs, and the difference is money.
   */
  const forbidden = [
    { what: "verify a vendor", method: "PATCH" as const, url: "/ops/vendors/:vendor", body: { status: "verified" } },
    { what: "change a domain's commission", method: "PATCH" as const, url: "/ops/domains/:domain", body: { defaultCommissionPercent: 5 } },
  ];

  test.each(forbidden)("a sales agent cannot $what", async ({ method, url, body }) => {
    const vendor = await one<{ id: string }>(`SELECT id FROM professionals LIMIT 1`);
    const domain = await one<{ id: string }>(`SELECT id FROM domains LIMIT 1`);
    const target = url.replace(":vendor", vendor.id).replace(":domain", domain.id);

    const instance = await app();
    const response = await instance.inject({
      method,
      url: target,
      headers: { cookie: agent },
      payload: body,
    });

    expect(response.statusCode, `an agent was allowed to ${url}`).toBe(403);
  });

  test("an admin can do the same thing", async () => {
    const domain = await one<{ id: string; default_commission_percent: number }>(
      `SELECT id, default_commission_percent FROM domains LIMIT 1`,
    );
    const instance = await app();

    const response = await instance.inject({
      method: "PATCH",
      url: `/ops/domains/${domain.id}`,
      headers: { cookie: admin },
      payload: { defaultCommissionPercent: Number(domain.default_commission_percent) },
    });

    // The assertion is that it is *not* refused for lack of permission.
    expect(response.statusCode).not.toBe(403);
  });

  test("a customer cannot reach the ops panel at all", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: "/ops/leads",
      headers: { cookie: customerA },
    });
    expect([401, 403]).toContain(response.statusCode);
  });
});

describe("only eligible vendors can be assigned", () => {
  /**
   * "Eligible" means verified, approved for that trade, serving that city, and
   * signed up on the current terms. The rule lived in two places that could
   * disagree; it is one view now. The test posts an ineligible vendor's id
   * directly, which is exactly what the old code would have accepted.
   */
  test("an unsigned vendor is in no pool", async (ctx) => {
    const unsigned = await maybe<{ id: string }>(
      `SELECT p.id FROM professionals p
       WHERE p.verification_status = 'verified'
         AND NOT EXISTS (
           SELECT 1 FROM eligible_vendors ev WHERE ev.professional_id = p.id
         )
       LIMIT 1`,
    );
    needs(ctx, unsigned, "a verified vendor who has not signed");

    const service = await one<{ id: string }>(`SELECT id FROM lead_domains LIMIT 1`);
    const instance = await app();

    const pool = await instance.inject({
      method: "GET",
      url: `/ops/services/${service.id}/pool`,
      headers: { cookie: admin },
    });
    if (pool.statusCode === 200) {
      expect(pool.body.includes(unsigned.id), "an ineligible vendor appeared in the pool").toBe(
        false,
      );
    }
  });

  test("posting an ineligible vendor's id directly is refused", async (ctx) => {
    const unsigned = await maybe<{ id: string }>(
      `SELECT p.id FROM professionals p
       WHERE NOT EXISTS (SELECT 1 FROM eligible_vendors ev WHERE ev.professional_id = p.id)
       LIMIT 1`,
    );
    needs(ctx, unsigned, "a vendor who is not eligible");

    const service = await one<{ id: string }>(
      `SELECT id FROM lead_domains WHERE status = 'pending_assignment' LIMIT 1`,
    ).catch(() => one<{ id: string }>(`SELECT id FROM lead_domains LIMIT 1`));

    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: `/ops/services/${service.id}/assign`,
      headers: { cookie: admin },
      payload: { professionalIds: [unsigned.id] },
    });

    expect(response.statusCode, "an ineligible vendor was assigned").toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
  });
});
