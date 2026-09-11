/**
 * The document numbers verification checks before a human looks.
 *
 * Only format and consistency — whether a PAN was really issued is what the
 * review is for — but a GSTIN that does not contain the PAN beside it means the
 * two documents belong to different businesses, and that is worth catching at
 * the form rather than at the reviewer's desk.
 */
import { describe, expect, it } from "vitest";
import { gstinMatchesPan, gstinSchema, panSchema } from "../src/common";

describe("PAN", () => {
  it("accepts one typed in lower case with spaces, and stores it as printed", () => {
    expect(panSchema.parse(" abcde 1234f ")).toBe("ABCDE1234F");
  });

  it("refuses one with a digit where a letter belongs", () => {
    expect(panSchema.safeParse("ABCD11234F").success).toBe(false);
  });
});

describe("GSTIN", () => {
  it("accepts a well-formed one", () => {
    expect(gstinSchema.parse("09abcde1234f1z5")).toBe("09ABCDE1234F1Z5");
  });

  it("refuses one without the fixed Z", () => {
    expect(gstinSchema.safeParse("09ABCDE1234F1A5").success).toBe(false);
  });

  it("is matched against the PAN inside it", () => {
    expect(gstinMatchesPan("09ABCDE1234F1Z5", "abcde1234f")).toBe(true);
    expect(gstinMatchesPan("09ABCDE1234F1Z5", "ABCDE9999F")).toBe(false);
  });
});
