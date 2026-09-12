/**
 * A vendor's work and achievements, from the apps' side of the seam.
 *
 * The vendor posts; our team approves, sends back, or takes down. Only approved
 * items reach a public profile — see `toProfessionalProfile` for the seed side
 * and `modules/vendor/showcase.ts` for the API.
 */
import type {
  City,
  MediaAsset,
  PortfolioItem,
  VendorAchievement,
  VendorAchievementKind,
  VendorShowcase,
} from "@repo/types";
import { api, nullWhenMissing } from "./client";
import { callingApiAsUser, currentProfessionalId, currentStaffUserId } from "./session";
import { delay, nextId, nowIso, store } from "./store";
import type { VerificationDecision } from "./verification";

export interface PortfolioDraft {
  /** One of the trades the vendor is approved for. */
  domainId: string;
  cityId?: string | null;
  title: string;
  /** The one-line summary, in plain text. */
  description: string;
  /** Short lines a customer skims: materials, size, how long it took. */
  highlights?: string[];
  /** The long description, as HTML. The API sanitises it before storing. */
  details?: string;
  /** Already uploaded with purpose `portfolio_item`. */
  media: MediaAsset[];
}

export interface AchievementDraft {
  kind: VendorAchievementKind;
  title: string;
  issuer: string;
  year?: number | null;
  description: string;
  /** An optional photograph of the certificate, uploaded with purpose `portfolio_item`. */
  media: MediaAsset[];
}

/* ------------------------------------------------------------------ *
 * The vendor's side
 * ------------------------------------------------------------------ */

export async function listMyAchievements(): Promise<VendorAchievement[]> {
  if (await callingApiAsUser()) return api<VendorAchievement[]>("/vendor/achievements");

  const professionalId = await currentProfessionalId();
  return delay(
    store.vendorAchievements.filter((a) => a.professionalId === professionalId && a.deletedAt === null),
  );
}

export async function addPortfolioItem(draft: PortfolioDraft): Promise<PortfolioItem> {
  if (await callingApiAsUser()) {
    return api<PortfolioItem>("/vendor/portfolio", {
      method: "POST",
      body: {
        domainId: draft.domainId,
        cityId: draft.cityId ?? null,
        title: draft.title,
        description: draft.description,
        highlights: draft.highlights ?? [],
        details: draft.details ?? "",
        media: draft.media.map((m) => m.id),
      },
    });
  }

  const professionalId = await currentProfessionalId();
  const approved = store.professionalDomains.some(
    (pd) =>
      pd.professionalId === professionalId &&
      pd.domainId === draft.domainId &&
      pd.verificationStatus === "approved",
  );
  if (!approved) throw new Error("Choose one of the trades you are approved for");
  if (draft.media.length === 0) throw new Error("Add at least one photo");

  const item: PortfolioItem = {
    id: nextId("pf"),
    professionalId,
    domainId: draft.domainId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    highlights: (draft.highlights ?? []).map((line) => line.trim()).filter(Boolean),
    details: draft.details ?? "",
    media: draft.media,
    // Public the moment it is posted, as on the API. The mock store showing
    // "awaiting approval" would teach the wrong thing to anybody demoing.
    moderationStatus: "approved",
    cityId: draft.cityId ?? null,
    reviewNote: null,
    reviewedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.portfolioItems.unshift(item);
  return delay(item);
}

export async function removePortfolioItem(id: string): Promise<void> {
  if (await callingApiAsUser()) {
    await api(`/vendor/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }

  const professionalId = await currentProfessionalId();
  const item = store.portfolioItems.find(
    (p) => p.id === id && p.professionalId === professionalId && p.deletedAt === null,
  );
  if (!item) throw new Error("That work could not be found");
  item.deletedAt = nowIso();
  return delay(undefined);
}

export async function addAchievement(draft: AchievementDraft): Promise<VendorAchievement> {
  if (await callingApiAsUser()) {
    return api<VendorAchievement>("/vendor/achievements", {
      method: "POST",
      body: {
        kind: draft.kind,
        title: draft.title,
        issuer: draft.issuer,
        year: draft.year ?? null,
        description: draft.description,
        media: draft.media.map((m) => m.id),
      },
    });
  }

  const professionalId = await currentProfessionalId();
  const achievement: VendorAchievement = {
    id: nextId("ach"),
    professionalId,
    kind: draft.kind,
    title: draft.title.trim(),
    issuer: draft.issuer.trim(),
    year: draft.year ?? null,
    description: draft.description.trim(),
    media: draft.media,
    moderationStatus: "pending",
    reviewNote: null,
    reviewedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.vendorAchievements.unshift(achievement);
  return delay(achievement);
}

export async function removeAchievement(id: string): Promise<void> {
  if (await callingApiAsUser()) {
    await api(`/vendor/achievements/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }

  const professionalId = await currentProfessionalId();
  const achievement = store.vendorAchievements.find(
    (a) => a.id === id && a.professionalId === professionalId && a.deletedAt === null,
  );
  if (!achievement) throw new Error("That achievement could not be found");
  achievement.deletedAt = nowIso();
  return delay(undefined);
}

/* ------------------------------------------------------------------ *
 * The reviewer's side
 * ------------------------------------------------------------------ */

export async function getVendorShowcaseFor(professionalId: string): Promise<VendorShowcase | null> {
  if (await callingApiAsUser()) {
    return nullWhenMissing(
      api<VendorShowcase>(`/ops/vendors/${encodeURIComponent(professionalId)}/showcase`),
    );
  }

  return delay({
    portfolio: store.portfolioItems.filter(
      (p) => p.professionalId === professionalId && p.deletedAt === null,
    ),
    achievements: store.vendorAchievements.filter(
      (a) => a.professionalId === professionalId && a.deletedAt === null,
    ),
  });
}

export async function reviewPortfolioItem(
  id: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<void> {
  if (await callingApiAsUser()) {
    await api(`/ops/portfolio/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: { decision, note },
    });
    return;
  }

  const item = store.portfolioItems.find((p) => p.id === id && p.deletedAt === null);
  if (!item) throw new Error("That work could not be found");
  Object.assign(item, reviewed(decision, note), { reviewedByUserId: await currentStaffUserId() });
  return delay(undefined);
}

export async function reviewAchievement(
  id: string,
  decision: VerificationDecision,
  note: string | null,
): Promise<void> {
  if (await callingApiAsUser()) {
    await api(`/ops/achievements/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: { decision, note },
    });
    return;
  }

  const achievement = store.vendorAchievements.find((a) => a.id === id && a.deletedAt === null);
  if (!achievement) throw new Error("That achievement could not be found");
  Object.assign(achievement, reviewed(decision, note));
  await currentStaffUserId();
  return delay(undefined);
}

function reviewed(decision: VerificationDecision, note: string | null) {
  const reason = note?.trim() || null;
  if (decision === "reject" && (!reason || reason.length < 10)) {
    throw new Error("Say why — the vendor is shown this");
  }
  return {
    moderationStatus: decision === "accept" ? ("approved" as const) : ("rejected" as const),
    reviewNote: reason,
    reviewedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

/* ------------------------------------------------------------------ *
 * Where a vendor works
 * ------------------------------------------------------------------ */

/**
 * The districts this vendor covers.
 *
 * Leads are routed through exactly this list, which is why it is editable at
 * all: it was written once at approval and then frozen, so a vendor who took
 * on a second district simply never heard about work there.
 */
export async function listMyServiceAreas(): Promise<City[]> {
  if (await callingApiAsUser()) return api<City[]>("/vendor/service-areas");

  const professionalId = await currentProfessionalId();
  const ids = new Set(
    store.professionalServiceAreas
      .filter((a) => a.professionalId === professionalId && a.deletedAt === null)
      .map((a) => a.cityId),
  );
  return delay(store.cities.filter((c) => ids.has(c.id)));
}

/** Replaces the list wholesale — unticked means no longer covered. */
export async function setMyServiceAreas(cityIds: string[]): Promise<City[]> {
  if (await callingApiAsUser()) {
    return api<City[]>("/vendor/service-areas", { method: "PUT", body: { cityIds } });
  }

  const professionalId = await currentProfessionalId();
  const now = nowIso();

  for (const area of store.professionalServiceAreas) {
    if (area.professionalId !== professionalId) continue;
    area.deletedAt = cityIds.includes(area.cityId) ? null : now;
  }

  for (const cityId of cityIds) {
    const existing = store.professionalServiceAreas.find(
      (a) => a.professionalId === professionalId && a.cityId === cityId,
    );
    if (existing) continue;
    store.professionalServiceAreas.push({
      id: nextId("psa"),
      professionalId,
      cityId,
      localities: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  return listMyServiceAreas();
}
