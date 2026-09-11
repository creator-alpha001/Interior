/**
 * Verified is earned, not set.
 *
 * The tag tells a customer we hold a signed original and business documents for
 * this vendor, and it is what puts them in a lead pool. So the thing worth
 * proving is the refusal: an admin pressing "Verified" on a vendor whose
 * paperwork is not complete is turned away, and the status does not move.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { app, maybe, needs, staffSession } from "./helpers/harness";

let admin: string;

beforeAll(async () => {
  admin = await staffSession("admin@example.com");
});

async function vendorWithoutPaperwork() {
  return maybe<{ id: string }>(
    `SELECT p.id FROM professionals p
     WHERE p.verification_status = 'pending'
       AND p.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM vendor_documents d
         WHERE d.professional_id = p.id AND d.status = 'accepted' AND d.deleted_at IS NULL
       )
     LIMIT 1`,
  );
}

describe("verification needs the paperwork, not a button", () => {
  test("a vendor with nothing accepted cannot be marked verified", async (context) => {
    const vendor = await vendorWithoutPaperwork();
    needs(context, vendor, "a pending vendor with no accepted documents");

    const instance = await app();
    const response = await instance.inject({
      method: "PATCH",
      url: `/ops/vendors/${vendor.id}`,
      headers: { cookie: admin },
      payload: { status: "verified" },
    });

    expect(response.statusCode).toBe(409);

    const after = await maybe<{ verification_status: string }>(
      `SELECT verification_status FROM professionals WHERE id = '${vendor.id}'`,
    );
    expect(after?.verification_status).toBe("pending");
  });

  test("the reviewer is told what is missing", async (context) => {
    const vendor = await vendorWithoutPaperwork();
    needs(context, vendor, "a pending vendor with no accepted documents");

    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: `/ops/vendors/${vendor.id}/verification`,
      headers: { cookie: admin },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ canBeVerified: boolean; outstanding: string[] }>();
    expect(body.canBeVerified).toBe(false);
    expect(body.outstanding.length).toBeGreaterThan(0);
  });
});
