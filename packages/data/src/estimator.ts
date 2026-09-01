import type { Rupees } from "@repo/types";
import { delay, store } from "./store";

/**
 * The rough cost calculator on the home screen.
 *
 * Deliberately domain-aware: painting is priced on painted area, furniture per
 * piece, fabrication per running foot, interiors per project. Every result is a
 * range, never a figure — an estimate that looks precise is worse than one that
 * admits what it is, because the customer anchors on it and then feels misled
 * when the real quote arrives.
 */

export type EstimatorInputKind = "rooms" | "area" | "pieces" | "running_ft";

export interface EstimatorField {
  key: string;
  label: string;
  hint: string;
  kind: EstimatorInputKind;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface EstimatorTier {
  key: string;
  label: string;
  hint: string;
  multiplier: number;
}

export interface EstimatorConfig {
  domainId: string;
  domainSlug: string;
  domainName: string;
  /** Plain-English statement of what drives the price in this trade. */
  basis: string;
  field: EstimatorField;
  tiers: EstimatorTier[];
  /** Rate per unit at the baseline tier, before the tier multiplier. */
  baseRate: Rupees;
  /** Fixed amount added regardless of size — mobilisation, setup, supervision. */
  fixed: Rupees;
  /** How wide the quoted range is either side of the midpoint, as a fraction. */
  spread: number;
  caveats: string[];
}

const configs: EstimatorConfig[] = [
  {
    domainId: "dom-painting",
    domainSlug: "painting",
    domainName: "Painting",
    basis: "Painting is priced on painted area. A 1000 sq.ft carpet-area flat has roughly 3,200 sq.ft of wall and ceiling to paint.",
    field: {
      key: "carpetArea",
      label: "Carpet area",
      hint: "We convert this to painted area at roughly 3.2×",
      kind: "area",
      min: 300,
      max: 4000,
      step: 50,
      default: 1000,
    },
    tiers: [
      { key: "repaint", label: "Repaint", hint: "Walls already puttied, minor repair", multiplier: 1 },
      { key: "full_putty", label: "Repaint + full putty", hint: "Two coats putty and sanding", multiplier: 1.55 },
      { key: "fresh", label: "Fresh painting", hint: "New plaster, full system", multiplier: 1.9 },
    ],
    baseRate: 24 * 3.2,
    fixed: 4000,
    spread: 0.18,
    caveats: [
      "Assumes premium emulsion. A luxury product line adds roughly 40%.",
      "Excludes exterior walls, texture finishes and waterproofing.",
      "Excludes wood and metal polishing.",
    ],
  },
  {
    domainId: "dom-furniture",
    domainSlug: "furniture",
    domainName: "Furniture Work",
    basis: "Furniture is priced per piece, or per sq.ft of shutter area for storage. This estimates a typical mix of wardrobe, bed and unit work.",
    field: {
      key: "pieces",
      label: "Number of pieces",
      hint: "Wardrobes, beds, units — count each item",
      kind: "pieces",
      min: 1,
      max: 15,
      step: 1,
      default: 3,
    },
    tiers: [
      { key: "laminate", label: "Laminate", hint: "BWR ply, laminate finish", multiplier: 1 },
      { key: "membrane", label: "Membrane / veneer", hint: "Seamless or natural finish", multiplier: 1.35 },
      { key: "acrylic", label: "Acrylic / PU", hint: "Premium finish, soft-close throughout", multiplier: 1.7 },
    ],
    baseRate: 38000,
    fixed: 6000,
    spread: 0.25,
    caveats: [
      "Assumes standard sizes. Floor-to-ceiling and loft work costs more.",
      "Excludes loose furniture, mattresses and soft furnishing.",
      "If you supply the board yourself, expect roughly 30% less.",
    ],
  },
  {
    domainId: "dom-fabrication",
    domainSlug: "fabrication",
    domainName: "Fabrication",
    basis: "Fabrication is priced per running foot or per sq.ft of fabricated area, and the metal you choose moves the figure more than anything else.",
    field: {
      key: "runningFt",
      label: "Approximate running feet",
      hint: "Total of gates, grills and railings",
      kind: "running_ft",
      min: 5,
      max: 300,
      step: 5,
      default: 60,
    },
    tiers: [
      { key: "ms_enamel", label: "MS, enamel", hint: "Mild steel, painted on site", multiplier: 1 },
      { key: "ms_powder", label: "MS, powder coated", hint: "Workshop finish, lasts far longer", multiplier: 1.2 },
      { key: "ss", label: "Stainless 304", hint: "No rust, no repainting", multiplier: 2.6 },
    ],
    baseRate: 620,
    fixed: 5000,
    spread: 0.22,
    caveats: [
      "Design complexity matters — laser-cut panels and glass infill add substantially.",
      "Excludes motorisation, civil work and site preparation.",
      "Site measurement will change the running feet, usually upward.",
    ],
  },
  {
    domainId: "dom-interior",
    domainSlug: "interior-design",
    domainName: "Interior Design",
    basis: "Turnkey interiors are quoted per project against a BOQ. This estimate is anchored on home size and the finish level you choose.",
    field: {
      key: "bedrooms",
      label: "Bedrooms",
      hint: "1BHK through 5BHK or villa",
      kind: "rooms",
      min: 1,
      max: 5,
      step: 1,
      default: 2,
    },
    tiers: [
      { key: "essential", label: "Essential", hint: "Kitchen, wardrobes, TV unit", multiplier: 1 },
      { key: "premium", label: "Premium", hint: "Adds ceiling, lighting, panelling", multiplier: 1.7 },
      { key: "luxury", label: "Luxury", hint: "Bespoke detailing throughout", multiplier: 2.8 },
    ],
    baseRate: 290000,
    fixed: 120000,
    spread: 0.2,
    caveats: [
      "Excludes civil, plumbing and electrical rework.",
      "Excludes appliances and loose furniture.",
      "A real figure comes from the BOQ after the site visit — this is only a bracket.",
    ],
  },
];

export async function listEstimatorConfigs(): Promise<EstimatorConfig[]> {
  const order = store.domains.map((d) => d.id);
  return delay(
    [...configs].sort((a, b) => order.indexOf(a.domainId) - order.indexOf(b.domainId)),
  );
}

export interface EstimateResult {
  low: Rupees;
  high: Rupees;
  mid: Rupees;
}

/** Pure function — the same maths runs on the server and in the browser. */
export function estimate(config: EstimatorConfig, quantity: number, tierKey: string): EstimateResult {
  const tier = config.tiers.find((t) => t.key === tierKey) ?? config.tiers[0];
  const mid = Math.round((config.baseRate * quantity * tier.multiplier + config.fixed) / 1000) * 1000;
  return {
    mid,
    low: Math.round((mid * (1 - config.spread)) / 1000) * 1000,
    high: Math.round((mid * (1 + config.spread)) / 1000) * 1000,
  };
}
