/**
 * Who may put a picture on the shop front.
 *
 * Every other upload purpose belongs to the person uploading — their room,
 * their proof of work, their trade documents — so "is somebody signed in" was
 * a sufficient check for all of them. `catalogue_image` is the first that is
 * not: it appears on pages every visitor sees, and a customer being able to
 * request a ticket for one is a stranger putting photographs on the shop front.
 *
 * The refusals are asserted by message rather than by type, because both roles
 * are stopped by a `ForbiddenError` and only the message says which rule did
 * it — and getting those two rules confused is precisely the mistake worth
 * catching.
 */
import { describe, expect, test } from "vitest";
import { createUploadTicket } from "../src/modules/uploads/repository";

const ticket = {
  purpose: "catalogue_image" as const,
  fileName: "sofa.jpg",
  contentType: "image/jpeg",
  sizeBytes: 900_000,
};

describe("catalogue image uploads", () => {
  test("a signed-out visitor is told to sign in", async () => {
    await expect(createUploadTicket(null, ticket)).rejects.toThrow(/sign in to upload/i);
  });

  test("a signed-in customer is refused", async () => {
    // The dangerous case: signed in, so the old check passed, and the picture
    // would have landed on a page everybody sees.
    await expect(createUploadTicket("user-1", ticket, "client")).rejects.toThrow(
      /only staff can upload catalogue images/i,
    );
  });

  test("a signed-in vendor is refused", async () => {
    await expect(createUploadTicket("user-2", ticket, "professional")).rejects.toThrow(
      /only staff can upload catalogue images/i,
    );
  });

  test("a requirement photo from a signed-out visitor still works", async () => {
    // The reason the guard is per-purpose rather than a blanket "sign in
    // first": the public requirement form deliberately lets somebody attach
    // photographs of their room before they have an account.
    const issued = await createUploadTicket(null, {
      ...ticket,
      purpose: "requirement_photo",
      fileName: "room.jpg",
    });
    expect(issued.uploadUrl).toBeTruthy();
    expect(issued.assetId).toBeTruthy();
  });

  test("staff get through, and the key is filed under the purpose", async () => {
    for (const role of ["sales_agent", "admin"]) {
      const issued = await createUploadTicket("staff-1", ticket, role);
      // The storage key carries the purpose, which is what keeps catalogue
      // photography out of the same prefix as customers' room photographs.
      expect(issued.uploadUrl).toContain("catalogue_image/");
      expect(issued.publicUrl).toContain("catalogue_image/");
    }
  });
});
