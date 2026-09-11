/**
 * A vendor's work and achievements: what they post, and what our team lets
 * reach their public profile.
 *
 * Everything posted starts pending. Our team approves it, sends it back with a
 * reason, or takes down something already approved — also with a reason, since
 * the vendor reads it. Only approved items are public; the public directory
 * reads them through `listPortfolioItems` / `listAchievements` with
 * `approvedOnly`.
 *
 * A vendor may only post work in a trade they are approved for. A fabricator's
 * painting job on their profile would advertise work nobody has vetted them to
 * do.
 */
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type {
  MediaAsset,
  PortfolioItem,
  VendorAchievement,
  VendorAchievementKind,
  VendorShowcase,
} from "@repo/types";
import { db, transaction } from "../../db/client";
import * as t from "../../db/schema";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { groupMediaByOwner, type MediaRow } from "../../lib/media";
import { toPortfolioItem } from "../../lib/mappers";
import { attachMedia } from "../uploads/repository";

const PORTFOLIO_OWNER = "portfolio_item";
const ACHIEVEMENT_OWNER = "vendor_achievement";

type Decision = "accept" | "reject";
type AchievementRow = typeof t.vendorAchievements.$inferSelect;

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

export async function listPortfolioItems(
  professionalId: string,
  options: { approvedOnly?: boolean } = {},
): Promise<PortfolioItem[]> {
  const rows = await db
    .select()
    .from(t.portfolioItems)
    .where(
      and(
        eq(t.portfolioItems.professionalId, professionalId),
        isNull(t.portfolioItems.deletedAt),
        options.approvedOnly ? eq(t.portfolioItems.moderationStatus, "approved") : undefined,
      ),
    )
    .orderBy(desc(t.portfolioItems.createdAt));

  const media = await mediaFor(PORTFOLIO_OWNER, rows.map((r) => r.id));
  return rows.map((row) => toPortfolioItem(row, media.get(row.id) ?? []));
}

export async function listAchievements(
  professionalId: string,
  options: { approvedOnly?: boolean } = {},
): Promise<VendorAchievement[]> {
  const rows = await db
    .select()
    .from(t.vendorAchievements)
    .where(
      and(
        eq(t.vendorAchievements.professionalId, professionalId),
        isNull(t.vendorAchievements.deletedAt),
        options.approvedOnly ? eq(t.vendorAchievements.moderationStatus, "approved") : undefined,
      ),
    )
    .orderBy(desc(t.vendorAchievements.year), desc(t.vendorAchievements.createdAt));

  const media = await mediaFor(ACHIEVEMENT_OWNER, rows.map((r) => r.id));
  return rows.map((row) => toAchievement(row, media.get(row.id) ?? []));
}

/** Everything a vendor has posted, for the reviewer. */
export async function getShowcase(professionalId: string): Promise<VendorShowcase> {
  const [portfolio, achievements] = await Promise.all([
    listPortfolioItems(professionalId),
    listAchievements(professionalId),
  ]);
  return { portfolio, achievements };
}

/* ------------------------------------------------------------------ *
 * What the vendor does
 * ------------------------------------------------------------------ */

export async function addPortfolioItem(
  professionalId: string,
  input: {
    domainId: string;
    cityId?: string | null;
    title: string;
    description: string;
    media: string[];
  },
): Promise<PortfolioItem> {
  const userId = await vendorUserId(professionalId);

  const [approved] = await db
    .select({ id: t.professionalDomains.id })
    .from(t.professionalDomains)
    .where(
      and(
        eq(t.professionalDomains.professionalId, professionalId),
        eq(t.professionalDomains.domainId, input.domainId),
        eq(t.professionalDomains.verificationStatus, "approved"),
        isNull(t.professionalDomains.deletedAt),
      ),
    )
    .limit(1);

  if (!approved) {
    throw new ValidationError("Choose one of the trades you are approved for");
  }

  if (input.cityId) {
    const [city] = await db
      .select({ id: t.cities.id })
      .from(t.cities)
      .where(eq(t.cities.id, input.cityId))
      .limit(1);
    if (!city) throw new ValidationError("That city is not one we know");
  }

  const id = await transaction(async (tx) => {
    const [row] = await tx
      .insert(t.portfolioItems)
      .values({
        professionalId,
        domainId: input.domainId,
        cityId: input.cityId ?? null,
        title: input.title.trim(),
        description: input.description.trim(),
      })
      .returning({ id: t.portfolioItems.id });

    await attachMedia(tx, input.media, PORTFOLIO_OWNER, row!.id, "portfolio_item", userId);
    return row!.id;
  });

  return portfolioItemById(id);
}

export async function removePortfolioItem(
  professionalId: string,
  id: string,
): Promise<{ ok: true }> {
  const now = new Date().toISOString();
  const removed = await db
    .update(t.portfolioItems)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(t.portfolioItems.id, id),
        eq(t.portfolioItems.professionalId, professionalId),
        isNull(t.portfolioItems.deletedAt),
      ),
    )
    .returning({ id: t.portfolioItems.id });

  if (removed.length === 0) throw new NotFoundError("That work");
  return { ok: true };
}

export async function addAchievement(
  professionalId: string,
  input: {
    kind: VendorAchievementKind;
    title: string;
    issuer: string;
    year?: number | null;
    description: string;
    media: string[];
  },
): Promise<VendorAchievement> {
  const userId = await vendorUserId(professionalId);

  if (input.year && input.year > new Date().getFullYear()) {
    throw new ValidationError("The year cannot be in the future");
  }

  const id = await transaction(async (tx) => {
    const [row] = await tx
      .insert(t.vendorAchievements)
      .values({
        professionalId,
        kind: input.kind,
        title: input.title.trim(),
        issuer: input.issuer.trim(),
        year: input.year ?? null,
        description: input.description.trim(),
      })
      .returning({ id: t.vendorAchievements.id });

    // A certificate photograph is an image like a portfolio photograph, so it
    // is uploaded with the same purpose and limits.
    await attachMedia(tx, input.media, ACHIEVEMENT_OWNER, row!.id, "portfolio_item", userId);
    return row!.id;
  });

  return achievementById(id);
}

export async function removeAchievement(
  professionalId: string,
  id: string,
): Promise<{ ok: true }> {
  const now = new Date().toISOString();
  const removed = await db
    .update(t.vendorAchievements)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(t.vendorAchievements.id, id),
        eq(t.vendorAchievements.professionalId, professionalId),
        isNull(t.vendorAchievements.deletedAt),
      ),
    )
    .returning({ id: t.vendorAchievements.id });

  if (removed.length === 0) throw new NotFoundError("That achievement");
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * What our team does
 * ------------------------------------------------------------------ */

/**
 * Approves, sends back, or takes down posted work.
 *
 * Taking down approved work is the same "reject" decision, so something that
 * turned out not to be the vendor's own work can come off a public profile
 * without a separate path — and the vendor is told why.
 */
export async function reviewPortfolioItem(
  staffUserId: string,
  id: string,
  decision: Decision,
  note: string | null,
): Promise<PortfolioItem> {
  const reason = requireReason(decision, note);
  const now = new Date().toISOString();

  const updated = await db
    .update(t.portfolioItems)
    .set({
      moderationStatus: decision === "accept" ? "approved" : "rejected",
      reviewNote: reason,
      reviewedAt: now,
      reviewedByUserId: staffUserId,
      updatedAt: now,
    })
    .where(and(eq(t.portfolioItems.id, id), isNull(t.portfolioItems.deletedAt)))
    .returning({ id: t.portfolioItems.id });

  if (updated.length === 0) throw new NotFoundError("That work");
  return portfolioItemById(id);
}

export async function reviewAchievement(
  staffUserId: string,
  id: string,
  decision: Decision,
  note: string | null,
): Promise<VendorAchievement> {
  const reason = requireReason(decision, note);
  const now = new Date().toISOString();

  const updated = await db
    .update(t.vendorAchievements)
    .set({
      moderationStatus: decision === "accept" ? "approved" : "rejected",
      reviewNote: reason,
      reviewedAt: now,
      reviewedByUserId: staffUserId,
      updatedAt: now,
    })
    .where(and(eq(t.vendorAchievements.id, id), isNull(t.vendorAchievements.deletedAt)))
    .returning({ id: t.vendorAchievements.id });

  if (updated.length === 0) throw new NotFoundError("That achievement");
  return achievementById(id);
}

/* ------------------------------------------------------------------ *
 * Plumbing
 * ------------------------------------------------------------------ */

async function portfolioItemById(id: string): Promise<PortfolioItem> {
  const [row] = await db.select().from(t.portfolioItems).where(eq(t.portfolioItems.id, id)).limit(1);
  if (!row) throw new NotFoundError("That work");
  const media = await mediaFor(PORTFOLIO_OWNER, [id]);
  return toPortfolioItem(row, media.get(id) ?? []);
}

async function achievementById(id: string): Promise<VendorAchievement> {
  const [row] = await db
    .select()
    .from(t.vendorAchievements)
    .where(eq(t.vendorAchievements.id, id))
    .limit(1);
  if (!row) throw new NotFoundError("That achievement");
  const media = await mediaFor(ACHIEVEMENT_OWNER, [id]);
  return toAchievement(row, media.get(id) ?? []);
}

function toAchievement(row: AchievementRow, media: MediaAsset[]): VendorAchievement {
  return {
    id: row.id,
    professionalId: row.professionalId,
    kind: row.kind,
    title: row.title,
    issuer: row.issuer,
    year: row.year,
    description: row.description,
    media,
    moderationStatus: row.moderationStatus,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

async function mediaFor(ownerType: string, ids: string[]): Promise<Map<string, MediaAsset[]>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({
      id: t.mediaAssets.id,
      type: t.mediaAssets.type,
      storageKey: t.mediaAssets.storageKey,
      caption: t.mediaAssets.caption,
      ownerType: t.mediaAssets.ownerType,
      ownerId: t.mediaAssets.ownerId,
      sortOrder: t.mediaAssets.sortOrder,
    })
    .from(t.mediaAssets)
    .where(
      and(
        eq(t.mediaAssets.ownerType, ownerType),
        inArray(t.mediaAssets.ownerId, ids),
        isNull(t.mediaAssets.deletedAt),
      ),
    )
    .orderBy(asc(t.mediaAssets.sortOrder));

  return groupMediaByOwner(rows as MediaRow[]);
}

async function vendorUserId(professionalId: string): Promise<string> {
  const [row] = await db
    .select({ userId: t.professionals.userId })
    .from(t.professionals)
    .where(and(eq(t.professionals.id, professionalId), isNull(t.professionals.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("That professional");
  return row.userId;
}

/** Sending something back, or taking it down, has to tell the vendor why. */
function requireReason(decision: Decision, note: string | null): string | null {
  const trimmed = note?.trim() || null;
  if (decision === "reject" && (!trimmed || trimmed.length < 10)) {
    throw new ValidationError("Say why — the vendor is shown this");
  }
  return trimmed;
}
