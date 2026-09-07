/**
 * Writing while row-level security is switched on.
 *
 * Two bugs lived here, both introduced when the policies landed and both
 * invisible to a suite that exercised the policies through reads. Between them
 * they meant that **no multi-table mutation on `/me` or `/vendor` worked at
 * all** — including `POST /me/agreements/:id/sign`, the largest transaction in
 * the system, which answered 500 for every customer.
 *
 * 1. A scoped request runs on a connection from `postgres.reserve()`, and a
 *    reservation does not carry `begin` — that is defined on the pool. Drizzle's
 *    `transaction` calls `client.begin(...)`, so every scoped transaction threw
 *    `this.client.begin is not a function`.
 * 2. Every policy was written `FOR ALL USING (...)` with no `WITH CHECK`, so
 *    Postgres applied the *read* rule to writes. That is right almost
 *    everywhere and wrong wherever one party's action creates a row belonging
 *    to the other — which is exactly what signing does when it raises the
 *    vendor's commission invoice.
 *
 * These tests exist so that neither can come back quietly. The failure mode of
 * both was a 500 on a write path, with every read test still green.
 */
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { withActor } from "../src/db/actor-context";
import { db, transaction, unscopedDb } from "../src/db/client";
import { maybe, one } from "./helpers/harness";

/** A seeded customer, and the scope a request of theirs would run under. */
async function aCustomer() {
  const row = await one<{ client_id: string; user_id: string }>(
    `SELECT c.id AS client_id, c.user_id FROM clients c JOIN users u ON u.id = c.user_id
     WHERE u.deleted_at IS NULL LIMIT 1`,
  );
  return {
    actor: { role: "client", userId: row.user_id, clientId: row.client_id } as never,
    ...row,
  };
}

describe("transactions inside an actor scope", () => {
  const marker = `scoped-writes-${Date.now()}`;

  afterAll(async () => {
    await unscopedDb.execute(sql`DELETE FROM notifications WHERE title = ${marker}`);
  });

  test("a transaction commits", async () => {
    const customer = await aCustomer();

    await withActor(customer.actor, () =>
      transaction(async (tx) => {
        await tx.execute(sql`
          INSERT INTO notifications (user_id, type, title, body)
          VALUES (${customer.user_id}, 'agreement_ready', ${marker}, 'committed')
        `);
      }),
    );

    const row = await maybe(
      `SELECT id FROM notifications WHERE title = '${marker}' AND body = 'committed'`,
    );
    expect(row).not.toBeNull();
  });

  /**
   * The half that matters more.
   *
   * A "transaction" that commits but cannot roll back is worse than no
   * transaction: `signAgreement` writes five tables, and a partial failure
   * leaves a customer with a signed contract and no project.
   */
  test("a transaction rolls back", async () => {
    const customer = await aCustomer();
    const failure = new Error("injected, after the write");

    await expect(
      withActor(customer.actor, () =>
        transaction(async (tx) => {
          await tx.execute(sql`
            INSERT INTO notifications (user_id, type, title, body)
            VALUES (${customer.user_id}, 'agreement_ready', ${marker}, 'rolled back')
          `);
          throw failure;
        }),
      ),
    ).rejects.toThrow(failure);

    const row = await maybe(
      `SELECT id FROM notifications WHERE title = '${marker}' AND body = 'rolled back'`,
    );
    expect(row).toBeNull();
  });

  /**
   * The connection has to be usable afterwards.
   *
   * A failed statement leaves the connection in an aborted transaction, and
   * every subsequent query on it answers "current transaction is aborted" until
   * something issues a ROLLBACK. Since the connection is reserved for the whole
   * request, forgetting that would turn one caught error into a dead request.
   */
  test("the connection still works after a rollback", async () => {
    const customer = await aCustomer();

    await withActor(customer.actor, async () => {
      await expect(
        transaction(async (tx) => {
          await tx.execute(sql`SELECT 1 FROM does_not_exist`);
        }),
      ).rejects.toThrow();

      const after = await db.execute(sql`SELECT 1 AS ok`);
      expect(after.length).toBe(1);
    });
  });
});

describe("writing a row that belongs to the other party", () => {
  /**
   * Signing raises the vendor's commission invoice inside the customer's
   * transaction. The policy is right that no customer may *see* a commission
   * figure — commission is between the vendor and the platform — and it was
   * also refusing them permission to create one, because USING was standing in
   * for WITH CHECK.
   *
   * Both halves are asserted here, because fixing this by loosening USING would
   * be far worse than the bug.
   */
  test("a customer can raise the invoice for their own agreement, and cannot read it", async (context) => {
    const agreement = await maybe<{
      id: string;
      client_id: string;
      professional_id: string;
      user_id: string;
    }>(`
      SELECT a.id, a.client_id, a.professional_id, u.id AS user_id
      FROM agreements a
      JOIN clients c ON c.id = a.client_id
      JOIN users u ON u.id = c.user_id
      LEFT JOIN commission_invoices ci ON ci.agreement_id = a.id
      WHERE ci.id IS NULL AND a.deleted_at IS NULL
      LIMIT 1
    `);

    // Skipped rather than passed: one invoice per agreement is a unique index,
    // so this needs an agreement that has none.
    if (!agreement) return context.skip("no agreement without an invoice");

    const reference = `INV-TEST-${Date.now()}`;
    const actor = {
      role: "client",
      userId: agreement.user_id,
      clientId: agreement.client_id,
    } as never;

    try {
      await withActor(actor, async () => {
        // The write the customer must be allowed to make.
        await db.execute(sql`
          INSERT INTO commission_invoices
            (reference, professional_id, agreement_id, amount, status, due_date)
          VALUES (${reference}, ${agreement.professional_id}, ${agreement.id},
                  1000, 'pending', current_date + 14)
        `);

        // And the read they must still never get. Deliberately unscoped SQL —
        // no WHERE at all — because the policy, not the query, is what has to
        // be hiding this.
        const visible = await db.execute(sql`SELECT id FROM commission_invoices`);
        expect(visible.length).toBe(0);
      });

      // It really was written, whatever the customer can see of it.
      const written = await maybe(
        `SELECT id FROM commission_invoices WHERE reference = '${reference}'`,
      );
      expect(written).not.toBeNull();
    } finally {
      await unscopedDb.execute(
        sql`DELETE FROM commission_invoices WHERE reference = ${reference}`,
      );
    }
  });

  test("a vendor still sees their own commission invoices", async (context) => {
    const invoice = await maybe<{ professional_id: string; user_id: string }>(`
      SELECT ci.professional_id, u.id AS user_id
      FROM commission_invoices ci
      JOIN professionals p ON p.id = ci.professional_id
      JOIN users u ON u.id = p.user_id
      LIMIT 1
    `);

    if (!invoice) return context.skip("no seeded commission invoice");

    await withActor(
      {
        role: "professional",
        userId: invoice.user_id,
        professionalId: invoice.professional_id,
      } as never,
      async () => {
        const rows = await db.execute(sql`SELECT id FROM commission_invoices`);
        expect(rows.length).toBeGreaterThan(0);
      },
    );
  });
});
