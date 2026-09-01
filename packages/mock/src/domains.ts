import type { Domain } from "@repo/types";
import { rec } from "./helpers";

/**
 * Four verticals at launch. Adding a fifth is an admin action — every module
 * downstream reads domainId, nothing is hardcoded to these four.
 */
export const domains: Domain[] = [
  {
    ...rec(400, 30),
    id: "dom-interior",
    name: "Interior Design",
    slug: "interior-design",
    tagline: "Full or partial home interiors, designed and executed",
    description:
      "End-to-end interiors for homes and offices — space planning, 3D design, modular kitchens, wardrobes, false ceiling, lighting and civil coordination, delivered by verified design firms.",
    iconKey: "interior",
    bannerUrl: null,
    defaultCommissionPercent: 10,
    isActive: true,
    sortOrder: 1,
    labels: {
      materials: "Board & Finish Brands",
      warranty: "Warranty",
      pricingBasis: "Priced per sq.ft of carpet area or per project BOQ",
    },
  },
  {
    ...rec(400, 30),
    id: "dom-furniture",
    name: "Furniture Work",
    slug: "furniture",
    tagline: "Custom furniture, made to your measurements",
    description:
      "Wardrobes, beds, sofas, dining sets, TV units, study tables and storage — either built on site by carpenters or factory-made and installed.",
    iconKey: "furniture",
    bannerUrl: null,
    defaultCommissionPercent: 8,
    isActive: true,
    sortOrder: 2,
    labels: {
      materials: "Board & Hardware Brand",
      warranty: "Warranty",
      pricingBasis: "Priced per piece, or per sq.ft of shutter area",
    },
  },
  {
    ...rec(400, 30),
    id: "dom-fabrication",
    name: "Fabrication",
    slug: "fabrication",
    tagline: "Gates, grills, railings and sheds in steel & aluminium",
    description:
      "Mild steel, stainless steel and aluminium fabrication — main gates, window grills, staircase railings, sheds, canopies, security doors and compound fencing.",
    iconKey: "fabrication",
    bannerUrl: null,
    defaultCommissionPercent: 6,
    isActive: true,
    sortOrder: 3,
    labels: {
      materials: "Material Grade",
      warranty: "Warranty",
      pricingBasis: "Priced per running foot, per sq.ft or per kg of material",
    },
  },
  {
    ...rec(400, 30),
    id: "dom-painting",
    name: "Painting",
    slug: "painting",
    tagline: "Interior, exterior, texture and waterproofing",
    description:
      "Repainting and fresh painting for interiors and exteriors, including putty and surface prep, texture finishes, wood and metal painting, and terrace waterproofing.",
    iconKey: "painting",
    bannerUrl: null,
    defaultCommissionPercent: 8,
    isActive: true,
    sortOrder: 4,
    labels: {
      materials: "Paint Brand & Type",
      warranty: "Warranty",
      pricingBasis: "Priced per sq.ft of painted area",
    },
  },
];

export const domainBySlug = Object.fromEntries(domains.map((d) => [d.slug, d]));
export const domainById = Object.fromEntries(domains.map((d) => [d.id, d]));
