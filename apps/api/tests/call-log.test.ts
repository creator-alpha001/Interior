/**
 * Calls stay visible, whoever made them.
 *
 * `lead_sales_activities.sales_agent_id` answers "which agent owns this lead",
 * and admins have no row in `sales_agents` at all. Three separate queries —
 * the queue's last-call column, the lead's call log, and the lead timeline —
 * reached the caller's name by inner-joining through that column, which
 * silently deleted every call an admin had made from all three. The lead read
 * "never called" the morning after somebody called it.
 *
 * The fix was to join through the user who logged the call. These tests hold it
 * there, because the failure mode is invisible: nothing errors, a row simply
 * stops appearing.
 */
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { db } from "../src/db/client";
import { app, one, staffSession } from "./helpers/harness";

let admin: string;
let leadId: string;

beforeAll(async () => {
  admin = await staffSession("admin@example.com");
  leadId = (await one<{ id: string }>(`SELECT id FROM leads ORDER BY reference LIMIT 1`)).id;
});

describe("a call logged by an admin", () => {
  test("is accepted at all", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "POST",
      url: `/ops/leads/${leadId}/calls`,
      headers: { cookie: admin },
      payload: { callStatus: "connected", remarks: "Scoped the job over the phone." },
    });

    expect(response.statusCode, response.body).toBe(201);

    const logged = response.json<{ salesAgentId: string | null; loggedByUserId: string }>();
    // No agent, because an admin is not one — and an attributed row regardless.
    expect(logged.salesAgentId).toBeNull();
    expect(logged.loggedByUserId).toBeTruthy();
  });

  test("appears in the lead's call log, with a name against it", async () => {
    // Read the name from the database rather than hard-coding it — "who said
    // this?" is the first question anybody asks of a call log, and asserting on
    // a literal would only prove the seed had not changed.
    const who = await one<{ name: string }>(
      `SELECT name FROM users WHERE email = 'admin@example.com'`,
    );
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/ops/leads/${leadId}/calls`,
      headers: { cookie: admin },
    });

    expect(response.statusCode).toBe(200);
    const body = response.body;
    expect(body).toContain("Scoped the job over the phone.");
    // The name comes from the user who logged it, not from a sales agent row.
    expect(body).toContain(who.name);
  });

  test("appears on the lead timeline", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/ops/leads/${leadId}/timeline`,
      headers: { cookie: admin },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Scoped the job over the phone.");
  });

  test("counts as a call in the queue, so the lead is not shown as never called", async () => {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/ops/leads?limit=100&status=all`,
      headers: { cookie: admin },
    });

    expect(response.statusCode).toBe(200);
    const rows = response.json<{
      items: Array<{ lead: { lead: { id: string } }; lastActivity: unknown }>;
    }>().items;

    const row = rows.find((r) => r.lead.lead.id === leadId);
    expect(row, "the lead was not in the queue at all").toBeTruthy();
    expect(row!.lastActivity, "an admin's call did not count as a call").toBeTruthy();
  });

  test("and the database still refuses a call attributed to nobody", async () => {
    await expect(
      db.execute(sql`
        INSERT INTO lead_sales_activities (lead_id, sales_agent_id, logged_by_user_id, call_status)
        VALUES (${leadId}, NULL, NULL, 'connected')
      `),
    ).rejects.toThrow();
  });
});
