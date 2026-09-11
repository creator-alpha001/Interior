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
import { presignPut, publicUrlFor, readUrlFor } from "../../lib/storage";

/** Limits per purpose, enforced here as well as in the browser. */
export const RULES: Record<UploadPurpose, { maxBytes: number; accept: string[] }> = {
  requirement_photo: { maxBytes: 10_000_000, accept: ["image/"] },
  milestone_proof: { maxBytes: 10_000_000, accept: ["image/"] },
  portfolio_item: { maxBytes: 10_000_000, accept: ["image/"] },
  vendor_document: { maxBytes: 20_000_000, accept: ["image/", "application/pdf"] },
  // Larger than the rest: these are the photographs the catalogue is sold on,
  // and they are shot properly rather than taken on a phone at a site visit.
  catalogue_image: { maxBytes: 15_000_000, accept: ["image/"] },
  // The agreement vendors print. A PDF, because that is what prints the same on
  // every printer in every shop it is taken to.
  agreement_template: { maxBytes: 20_000_000, accept: ["application/pdf"] },
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
  /**
   * The caller's role, for the purposes that are not open to everyone.
   *
   * "Signed in" was a sufficient check while every purpose belonged to the
   * person uploading — their room, their proof, their documents. Catalogue
   * photography does not: it appears on pages every visitor sees, so a customer
   * being able to request a ticket for one would be a stranger putting pictures
   * on the shop front.
   */
  role?: string,
): Promise<UploadTicket> {
  if (!userId && input.purpose !== "requirement_photo") {
    throw new ForbiddenError("Please sign in to upload this");
  }

  if (input.purpose === "catalogue_image" && role !== "admin" && role !== "sales_agent") {
    throw new ForbiddenError("Only staff can upload catalogue images");
  }

  // Every vendor downloads this file and signs it. A customer able to upload
  // one would be a stranger writing the contract.
  if (input.purpose === "agreement_template" && role !== "admin" && role !== "sales_agent") {
    throw new ForbiddenError("Only staff can upload the partner agreement");
  }

  // Business documents are a vendor's own, and nobody else's to supply.
  if (input.purpose === "vendor_document" && role !== "professional") {
    throw new ForbiddenError("Only a vendor can upload business documents");
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
    // A private file's "public" URL is a link that expires, so the form can
    // preview what was just uploaded without the file ever being public.
    publicUrl: readUrlFor(storageKey),
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

  /**
   * One statement per asset, so the order survives.
   *
   * A single `WHERE id IN (...)` cannot give each row a different sortOrder, so
   * every asset attached this way used to land on 0 and come back in whatever
   * order the index felt like. That was invisible while media was evidence —
   * six photographs of a room have no first — and is not invisible at all for a
   * catalogue, where `media[0]` is the picture on the card. The person choosing
   * which image leads is doing it by ordering this array.
   */
  const now = new Date().toISOString();
  for (const [index, assetId] of assetIds.entries()) {
    await tx
      .update(t.mediaAssets)
      .set({ ownerType, ownerId, sortOrder: index, confirmedAt: now, updatedAt: now })
      .where(eq(t.mediaAssets.id, assetId));
  }
}

/**
 * Attaches one asset and returns the URL to store on the row.
 *
 * For the two places that keep a URL in a column rather than reading their
 * media back — `domains.banner_url` and `product_categories.image_url`. Those
 * columns predate `media_assets` and the whole product reads them, so they
 * stay; what changes is that the asset behind the URL is now owned, which is
 * the difference between a banner that lasts and one the orphan sweep removes
 * overnight while the column goes on pointing at it.
 *
 * Null in, null out: clearing a banner is a thing somebody will want to do.
 */
export async function attachSingleImage(
  tx: Tx,
  assetId: string | null | undefined,
  ownerType: string,
  ownerId: string,
  uploaderUserId?: string,
): Promise<string | null | undefined> {
  if (assetId === undefined) return undefined;
  if (assetId === null) return null;

  await attachMedia(tx, [assetId], ownerType, ownerId, "catalogue_image", uploaderUserId);

  const [row] = await tx
    .select({ storageKey: t.mediaAssets.storageKey })
    .from(t.mediaAssets)
    .where(eq(t.mediaAssets.id, assetId))
    .limit(1);

  if (!row) throw new ValidationError("That image is no longer available");
  return publicUrlFor(row.storageKey);
}

/**
 * Makes the record's images exactly this list, in this order.
 *
 * Editing needs more than [attachMedia]: a form that can add a picture can also
 * remove one, and attaching is only half of that. Anything currently owned and
 * missing from `assetIds` is soft-deleted, so it stops appearing without
 * destroying the row — the same rule the rest of the platform follows, and the
 * reason support can still reconstruct what a page looked like last week.
 *
 * The R2 object itself stays. `sweepOrphanMedia` removes database rows and
 * leaves storage alone, which is a known gap rather than something decided
 * here; deleting the file would make this the one place in the product that
 * destroys a customer-visible asset irreversibly.
 */
export async function replaceOwnedMedia(
  tx: Tx,
  ownerType: string,
  ownerId: string,
  assetIds: string[],
  uploaderUserId?: string,
): Promise<void> {
  const now = new Date().toISOString();

  const existing = await tx
    .select({ id: t.mediaAssets.id })
    .from(t.mediaAssets)
    .where(
      and(
        eq(t.mediaAssets.ownerType, ownerType),
        eq(t.mediaAssets.ownerId, ownerId),
        isNull(t.mediaAssets.deletedAt),
      ),
    );

  const keep = new Set(assetIds);
  const dropped = existing.filter((row) => !keep.has(row.id)).map((row) => row.id);

  if (dropped.length > 0) {
    await tx
      .update(t.mediaAssets)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(t.mediaAssets.id, dropped));
  }

  // Re-attaching one this record already owns is fine and is the normal case
  // for a reorder: attachMedia only objects when the asset belongs to somebody
  // else, and rewrites sortOrder from the array position either way.
  await attachMedia(tx, assetIds, ownerType, ownerId, "catalogue_image", uploaderUserId);
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
