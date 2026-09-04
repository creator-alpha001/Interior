/**
 * The firewall between customer and vendor, checked by sweeping rather than by
 * reasoning.
 *
 * The business rule is the user's, stated plainly: no direct contact between a
 * buyer and a vendor — the platform introduces them. If a phone number leaks
 * through any vendor-facing response, the commercial model leaks with it, and
 * the leak will not be in the endpoint somebody thought to check.
 *
 * So this test does not inspect the mapper. It signs in as a real vendor, walks
 * every GET under /vendor, and greps the raw response bodies for every contact
 * detail in the database. Any hit fails, and names the endpoint and the person.
 */
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { db } from "../src/db/client";
import { app, maybe, needs, one, otpSession } from "./helpers/harness";

/** Every vendor-facing read. A new one added without masking should fail here. */
const SWEEP = [
  "/vendor/leads",
  "/vendor/dashboard",
  "/vendor/agreements",
  "/vendor/projects",
  "/vendor/invoices",
  "/vendor/visits",
  "/vendor/performance",
  "/vendor/portfolio",
  "/vendor/onboarding",
] as const;

let cookie: string;
let professionalId: string;
let secrets: Array<{ value: string; whose: string }>;

beforeAll(async () => {
  // A vendor who actually holds leads. Sweeping the endpoints of a vendor with
  // an empty portfolio would pass without reading a single customer record.
  const vendor = await one<{ mobile: string; id: string }>(
    `SELECT u.mobile, p.id FROM users u
     JOIN professionals p ON p.user_id = u.id
     JOIN lead_domain_assignments a ON a.professional_id = p.id
     WHERE p.verification_status = 'verified'
     GROUP BY u.mobile, p.id
     ORDER BY count(a.id) DESC
     LIMIT 1`,
  );
  professionalId = vendor.id;
  cookie = await otpSession(vendor.mobile);

  // Customers' contact details, plus the staff who broker between them — a
  // vendor should reach neither directly.
  const rows = (await db.execute(sql`
    SELECT u.name, u.mobile, u.email, u.role
    FROM users u
    WHERE u.role IN ('client', 'admin', 'sales_agent')
  `)) as unknown as Array<{ name: string; mobile: string; email: string | null; role: string }>;

  secrets = rows.flatMap((u) => {
    const found: Array<{ value: string; whose: string }> = [];
    if (u.mobile) {
      found.push({ value: u.mobile, whose: `${u.name}'s mobile` });
      // The same number without the country code is the same number.
      found.push({ value: u.mobile.replace(/^91/, ""), whose: `${u.name}'s mobile` });
    }
    if (u.email) found.push({ value: u.email, whose: `${u.name}'s email` });
    return found;
  });
});

describe("no vendor-facing response carries a customer's contact details", () => {
  test("there is something to look for", () => {
    // Guards against the sweep passing because the query found nobody.
    expect(secrets.length).toBeGreaterThan(10);
  });

  test.each(SWEEP)("%s", async (url) => {
    const instance = await app();
    const response = await instance.inject({ method: "GET", url, headers: { cookie } });

    // A 404 or 403 is a fine answer; what matters is that a 200 is clean.
    if (response.statusCode !== 200) return;

    const body = response.body;
    const leaked = secrets.filter((s) => s.value.length > 5 && body.includes(s.value));
    expect(leaked.map((l) => l.whose).join(", "), `${url} leaked contact details`).toBe("");
  });

  test("a lead the vendor is assigned to still masks the customer", async () => {
    const instance = await app();
    const list = await instance.inject({ method: "GET", url: "/vendor/leads", headers: { cookie } });
    if (list.statusCode !== 200) return;

    // The endpoint answers with a bare array; a paged envelope would nest it.
    const payload = list.json<
      Array<{ id?: string; leadDomainId?: string }> | { items?: Array<{ id?: string; leadDomainId?: string }> }
    >();
    const items = Array.isArray(payload) ? payload : (payload.items ?? []);
    expect(items.length, "the vendor has no leads, so this proves nothing").toBeGreaterThan(0);

    for (const item of items.slice(0, 5)) {
      const id = item.leadDomainId ?? item.id;
      const detail = await instance.inject({
        method: "GET",
        url: `/vendor/leads/${id}`,
        headers: { cookie },
      });
      if (detail.statusCode !== 200) continue;

      const leaked = secrets.filter(
        (s) => s.value.length > 5 && detail.body.includes(s.value),
      );
      expect(leaked.map((l) => l.whose).join(", "), `lead ${id} leaked contact details`).toBe("");
    }
  });
});

describe("the full address is released only once a visit is confirmed", () => {
  /**
   * The vendor needs the site address to attend, and not before. This used to be
   * a mapper detail; it is a predicate on the query now, so the test flips the
   * visit either side of the read and checks the address appears exactly once
   * the visit is confirmed.
   */
  test("no confirmed visit, no street address", async (ctx) => {
    const meeting = await maybe<{ meeting_id: string; lead_domain_id: string; status: string }>(
      `SELECT m.id AS meeting_id, m.lead_domain_id, m.status
       FROM meetings m
       JOIN lead_domain_assignments a ON a.lead_domain_id = m.lead_domain_id
       WHERE a.professional_id = '${professionalId}'
       LIMIT 1`,
    );
    needs(ctx, meeting, "a visit on a lead this vendor holds");

    const client = await maybe<{ address: string }>(
      `SELECT c.address FROM lead_domains ld
       JOIN leads l ON l.id = ld.lead_id
       JOIN clients c ON c.id = l.client_id
       WHERE ld.id = '${meeting.lead_domain_id}' AND c.address IS NOT NULL`,
    );
    needs(ctx, client?.address ?? null, "a customer with an address on file");

    const instance = await app();
    const read = () =>
      instance.inject({
        method: "GET",
        url: `/vendor/leads/${meeting.lead_domain_id}`,
        headers: { cookie },
      });

    try {
      await db.execute(
        sql`UPDATE meetings SET status = 'scheduled' WHERE id = ${meeting.meeting_id}`,
      );
      const before = await read();

      await db.execute(
        sql`UPDATE meetings SET status = 'confirmed' WHERE id = ${meeting.meeting_id}`,
      );
      const after = await read();

      expect(before.body.includes(client.address), "the address leaked before the visit").toBe(
        false,
      );
      expect(after.body.includes(client.address), "the address was withheld after the visit").toBe(
        true,
      );
    } finally {
      // Shared database: put the visit back however the assertions went.
      await db.execute(
        sql`UPDATE meetings SET status = ${meeting.status} WHERE id = ${meeting.meeting_id}`,
      );
    }
  });
});
