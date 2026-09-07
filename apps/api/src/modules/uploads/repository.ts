/**
 * Upload tickets.
 *
 * The browser asks for a ticket, PUTs the file straight at storage, then submits
 * the asset id with its form. Bytes never pass through this server — a vendor
 * uploading eight site photographs on mobile data would otherwise hold a request
 * open for minutes and occupy a connection the whole time.
 *
 * A row is written when the ticket is issued and confirmed when the form that
 * references it is submitted. Anything left unconfirmed is a ticket that was
 * never used, which the orphan sweep removes.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { UploadPurpose } from "@repo/contract";
import { db, type Tx } from "../../db/client";
import * as t from "../../db/schema";
import { ForbiddenError, ValidationError } from "../../lib/errors";
import { presignPut, publicUrlFor } from "../../lib/storage";

/** Limits per purpose, enforced here as well as in the browser. */
export const RULES: Record<UploadPurpose, { maxBytes: number; accept: string[] }> = {
  requirement_photo: { maxBytes: 10_000_000, accept: ["image/"] },
  milestone_proof: { maxBytes: 10_000_000, accept: ["image/"] },
  portfolio_item: { maxBytes: 10_000_000, accept: ["image/"] },
  vendor_document: { maxBytes: 20_000_000, accept: ["image/", "application/pdf"] },
};

export interface UploadTicket {
  uploadUrl: string;
  headers: Record<string, string>;
  assetId: string;
  publicUrl: string;
}

export interface TicketRequest {
  purpose: UploadPurpose;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Issues a ticket for one file.
 *
 * The frontend checks size and type before asking, but that is a courtesy to
 * the user — it runs in a browser the caller controls. These checks are the
 * ones that count.
 */
export async function createUploadTicket(
  /**
   * Null for a visitor who has not signed in yet.
   *
   * The public requirement form lets somebody attach photographs of their room
   * before it asks them to verify a number — asking for an account first is how
   * a form loses the people who opened it. Only `requirement_photo` may be
   * anonymous, and the route rate-limits it by address.
   */
  userId: string | null,
  input: TicketRequest,
): Promise<UploadTicket> {
  if (!userId && input.purpose !== "requirement_photo") {
    throw new ForbiddenError("Please sign in to upload this");
  }

  const rule = RULES[input.purpose];
  if (!rule) throw new ValidationError("Unknown upload purpose");

  if (!rule.accept.some((prefix) => input.contentType.startsWith(prefix))) {
    throw new ValidationError(`${input.fileName} is not a supported file type`);
  }
  if (input.sizeBytes > rule.maxBytes) {
    throw new ValidationError(
      `${input.fileName} is larger than ${Math.round(rule.maxBytes / 1_000_000)} MB`,
    );
  }

  const assetId = randomUUID();
  // The key never contains the original filename. Names carry personal detail
  // surprisingly often ("invoice-priya-sharma.pdf"), and object keys leak.
  const extension = extensionFor(input.contentType);
  const storageKey = `${input.purpose}/${assetId}${extension}`;

  await db.insert(t.mediaAssets).values({
    id: assetId,
    purpose: input.purpose,
    type: input.contentType === "application/pdf" ? "document" : "photo",
    storageKey,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    uploadedByUserId: userId,
  });

  return {
    ...(await presignPut(storageKey, input.contentType)),
    assetId,
    publicUrl: publicUrlFor(storageKey),
  };
}

function extensionFor(contentType: string): string {
  const known: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "application/pdf": ".pdf",
  };
  return known[contentType] ?? "";
}

/**
 * Binds uploaded assets to the record that now references them.
 *
 * Checks the uploader owns them, so one customer cannot attach another's
 * photographs to their own requirement by guessing an id.
 */
export async function attachMedia(
  tx: Tx,
  assetIds: string[],
  ownerType: string,
  ownerId: string,
  purpose: UploadPurpose,
  uploaderUserId?: string,
): Promise<void> {
  if (assetIds.length === 0) return;

  const rows = await tx
    .select({ id: t.mediaAssets.id, uploadedBy: t.mediaAssets.uploadedByUserId, ownerId: t.mediaAssets.ownerId })
    .from(t.mediaAssets)
    .where(and(inArray(t.mediaAssets.id, assetIds), eq(t.mediaAssets.purpose, purpose)));

  if (rows.length !== assetIds.length) {
    throw new ValidationError("One of those files is no longer available");
  }

  for (const row of rows) {
    if (row.ownerId && row.ownerId !== ownerId) {
      throw new ForbiddenError("That file is already attached to something else");
    }
    // An asset with no uploader came from a visitor who had not signed in yet,
    // which is the normal case for requirement photos — the account is created
    // moments later, in the same submission. One with an uploader must match.
    if (uploaderUserId && row.uploadedBy && row.uploadedBy !== uploaderUserId) {
      throw new ForbiddenError("That file was uploaded by somebody else");
    }
  }

  await tx
    .update(t.mediaAssets)
    .set({
      ownerType,
      ownerId,
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(t.mediaAssets.id, assetIds));
}

/** Removes tickets that were issued and never used. Run weekly. */
export async function sweepOrphans(olderThanHours = 24): Promise<number> {
  const rows = await db
    .delete(t.mediaAssets)
    .where(
      and(
        isNull(t.mediaAssets.ownerId),
        sql`${t.mediaAssets.createdAt} < now() - (${olderThanHours} * interval '1 hour')`,
      ),
    )
    .returning({ id: t.mediaAssets.id });

  return rows.length;
}
