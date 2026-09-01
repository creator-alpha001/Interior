import type { PackageItem, ProductCityPrice, ServicePackage } from "@repo/types";
import { phSet, rec } from "../helpers";

interface PackageSeed {
  slug: string;
  domainId: string;
  name: string;
  short: string;
  description: string;
  price: number;
  basis: string;
  days: number;
  inclusions: string[];
  exclusions: string[];
  badge?: string;
  featured?: boolean;
  items: Array<[label: string, quantity: number, productId: string | null]>;
}

const seeds: PackageSeed[] = [
  {
    slug: "essential-2bhk-interior",
    domainId: "dom-interior",
    name: "Essential 2BHK Interior Package",
    short: "Kitchen, two wardrobes and a TV unit — the working minimum",
    description:
      "The package most 2BHK owners actually start with: a modular kitchen, wardrobes in both bedrooms and a TV unit, in durable laminate finishes. No false ceiling and no decorative panelling, which is where budgets usually overrun. Everything is made to your wall sizes and installed by the same team that builds it.",
    price: 549000,
    basis: "per 2BHK (up to 1000 sq.ft)",
    days: 45,
    inclusions: [
      "Modular kitchen — base and wall units, laminate shutters",
      "Two wardrobes with internal shelving and hanging",
      "Wall-mounted TV unit",
      "Hettich soft-close hardware throughout",
      "Site measurement, 3D views and working drawings",
      "Installation and site cleaning",
    ],
    exclusions: [
      "False ceiling and lighting",
      "Civil, plumbing and electrical work",
      "Kitchen counter, sink and appliances",
      "Painting",
    ],
    badge: "Most popular",
    featured: true,
    items: [
      ["Modular kitchen (up to 100 sq.ft shutter area)", 1, "prod-modular-kitchen-design"],
      ["Sliding wardrobe", 2, "prod-sliding-wardrobe-2door"],
      ["Wall-mounted TV unit", 1, "prod-tv-unit-wall-mounted"],
    ],
  },
  {
    slug: "premium-3bhk-interior",
    domainId: "dom-interior",
    name: "Premium 3BHK Interior Package",
    short: "Full interiors with ceiling, lighting and a designed TV wall",
    description:
      "A complete 3BHK fit-out including everything in the Essential scope plus false ceiling with layered lighting, a panelled TV wall, a crockery unit and acrylic-finish kitchen shutters. Delivered in around ten weeks with a dedicated site supervisor.",
    price: 1450000,
    basis: "per 3BHK (up to 1600 sq.ft)",
    days: 75,
    inclusions: [
      "Modular kitchen with acrylic shutters and tandem baskets",
      "Three wardrobes, one with loft storage",
      "Panelled TV wall with concealed lighting",
      "Crockery unit",
      "False ceiling in living, dining and bedrooms",
      "Layered lighting plan with profile and cove lighting",
      "Dedicated site supervisor",
    ],
    exclusions: ["Civil and plumbing work", "Appliances", "Painting", "Loose furniture"],
    badge: "Best value",
    featured: true,
    items: [
      ["Modular kitchen — premium", 1, "prod-modular-kitchen-design"],
      ["Designed wardrobe", 3, "prod-wardrobe-design-package"],
      ["TV wall panelling", 1, "prod-tv-wall-panelling"],
      ["False ceiling with lighting", 1, "prod-false-ceiling-lighting"],
      ["Crockery unit", 1, "prod-crockery-unit"],
    ],
  },
  {
    slug: "kitchen-only-package",
    domainId: "dom-interior",
    name: "Modular Kitchen Package",
    short: "A full kitchen with counter, sink and accessories",
    description:
      "Just the kitchen, done completely — cabinets, quartz counter, sink and tap, tandem baskets and under-cabinet lighting, installed in three weeks. Priced for a standard L-shaped kitchen of about 90 sq.ft of shutter area.",
    price: 245000,
    basis: "per kitchen (up to 90 sq.ft shutter area)",
    days: 21,
    inclusions: [
      "Base, wall and one tall unit in marine ply",
      "Membrane finish shutters",
      "Quartz counter and stainless sink with tap",
      "Tandem baskets and cutlery organiser",
      "Under-cabinet LED lighting",
      "Installation",
    ],
    exclusions: ["Chimney, hob and appliances", "Tiling and plumbing shifting", "Dado / backsplash"],
    featured: true,
    items: [
      ["Modular kitchen cabinets", 1, "prod-modular-kitchen-design"],
      ["Quartz counter and sink", 1, null],
      ["Accessory pack", 1, null],
    ],
  },
  {
    slug: "rental-flat-package",
    domainId: "dom-interior",
    name: "Rental-Ready Flat Package",
    short: "Let-out-ready fit-out in five weeks, fixed price",
    description:
      "A deliberately restrained fit-out for a flat you are letting out — a compact kitchen, wardrobes in both rooms, and hard-wearing laminate finishes throughout, at a price that keeps the yield intact.",
    price: 385000,
    basis: "per 2BHK",
    days: 35,
    inclusions: [
      "Compact modular kitchen",
      "Two hinged wardrobes",
      "Basic TV unit",
      "Durable laminate finishes",
    ],
    exclusions: ["False ceiling", "Painting", "Appliances", "Decorative panelling"],
    items: [
      ["Modular kitchen — compact", 1, "prod-modular-kitchen-design"],
      ["Hinged wardrobe", 2, "prod-hinged-wardrobe-3door"],
      ["TV unit", 1, "prod-tv-unit-floor"],
    ],
  },
  {
    slug: "bedroom-furniture-set",
    domainId: "dom-furniture",
    name: "Complete Bedroom Set",
    short: "Bed, wardrobe, side tables and dresser as one set",
    description:
      "A matched bedroom set — queen bed with hydraulic storage, a sliding wardrobe up to 8 ft, two side tables and a dresser with mirror, all in the same finish so the room reads as one piece of work rather than four purchases.",
    price: 165000,
    basis: "per bedroom",
    days: 25,
    inclusions: [
      "Queen bed with hydraulic storage",
      "Sliding wardrobe up to 8 ft wide",
      "Two bedside tables",
      "Dresser with mirror",
      "Matched laminate finish across all pieces",
    ],
    exclusions: ["Mattress", "Loose furnishing", "Wall painting"],
    badge: "Most popular",
    featured: true,
    items: [
      ["Queen bed with storage", 1, "prod-queen-bed-storage"],
      ["Sliding wardrobe", 1, "prod-sliding-wardrobe-2door"],
      ["Bedside table", 2, null],
      ["Dresser with mirror", 1, null],
    ],
  },
  {
    slug: "living-room-furniture-set",
    domainId: "dom-furniture",
    name: "Living Room Furniture Set",
    short: "Sofa, TV unit, centre table and shoe cabinet",
    description:
      "Everything a living room needs in one go — an L-shaped five-seater made to your wall size, a wall-mounted TV unit, a centre table and an entryway shoe cabinet.",
    price: 128000,
    basis: "per living room",
    days: 25,
    inclusions: [
      "L-shaped 5-seater sofa in fabric of choice",
      "Wall-mounted TV unit",
      "Centre table",
      "Shoe cabinet",
    ],
    exclusions: ["Wall panelling", "Rugs and soft furnishing", "Lighting"],
    featured: true,
    items: [
      ["L-shaped sofa", 1, "prod-l-shaped-sofa"],
      ["Wall-mounted TV unit", 1, "prod-tv-unit-wall-mounted"],
      ["Centre table", 1, null],
      ["Shoe cabinet", 1, "prod-shoe-cabinet"],
    ],
  },
  {
    slug: "dining-set-package",
    domainId: "dom-furniture",
    name: "Dining Set Package",
    short: "Six-seater table with chairs and a crockery unit",
    description:
      "A six-seater dining table with six chairs and a matching crockery unit with lit display shelves — the dining room solved as one order, in a single finish.",
    price: 96000,
    basis: "per set",
    days: 22,
    inclusions: [
      "6-seater dining table",
      "Six dining chairs",
      "Crockery unit with LED-lit display",
    ],
    exclusions: ["Bar unit", "Wall panelling"],
    items: [
      ["6-seater dining table", 1, "prod-dining-table-6-seater"],
      ["Dining chair", 6, null],
      ["Crockery unit", 1, "prod-crockery-unit"],
    ],
  },
  {
    slug: "kids-room-furniture",
    domainId: "dom-furniture",
    name: "Kids Room Furniture Set",
    short: "Bed, study table, wardrobe and bookshelf",
    description:
      "A children's room set built for durability — a single bed with drawer storage, a wall-mounted study table, a wardrobe and an open bookshelf, in rounded-edge construction with non-toxic finishes.",
    price: 88000,
    basis: "per room",
    days: 20,
    inclusions: [
      "Single bed with drawer storage",
      "Wall-mounted study table",
      "Wardrobe up to 6 ft",
      "Open bookshelf",
      "Rounded edges and non-toxic finishes",
    ],
    exclusions: ["Mattress", "Wall painting", "Bunk bed upgrade"],
    items: [
      ["Single bed with storage", 1, "prod-queen-bed-storage"],
      ["Wall-mounted study table", 1, "prod-study-table-wall-mounted"],
      ["Hinged wardrobe", 1, "prod-hinged-wardrobe-3door"],
      ["Open bookshelf", 1, "prod-bookshelf-open"],
    ],
  },
  {
    slug: "home-security-fabrication",
    domainId: "dom-fabrication",
    name: "Home Security Package",
    short: "Safety door plus grills for every window",
    description:
      "A single order covering the security work on an independent house or ground-floor flat — one MS safety door and grills for up to eight windows, powder coated, measured and installed in a week.",
    price: 78000,
    basis: "per house (up to 8 windows)",
    days: 12,
    inclusions: [
      "One MS safety door with mortise lock",
      "Window grills for up to 8 windows",
      "Powder-coated finish",
      "Measurement, fabrication and installation",
    ],
    exclusions: ["Main gate", "Balcony railing", "Mosquito mesh"],
    badge: "Most popular",
    featured: true,
    items: [
      ["MS safety door", 1, "prod-ms-safety-door"],
      ["MS window grill", 8, "prod-ms-window-grill"],
    ],
  },
  {
    slug: "gate-and-railing-package",
    domainId: "dom-fabrication",
    name: "Gate & Railing Package",
    short: "Main gate with matching balcony railings",
    description:
      "A main sliding gate with balcony railings in the same design language and finish, so the front of the house reads as one design rather than as separately purchased parts.",
    price: 145000,
    basis: "per house (gate up to 14 ft + 40 rft railing)",
    days: 20,
    inclusions: [
      "MS sliding main gate up to 14 ft",
      "Balcony railing up to 40 running ft",
      "Matching powder-coated finish",
      "Installation with floor track",
    ],
    exclusions: ["Gate motorisation", "Compound fencing", "Civil work at track"],
    featured: true,
    items: [
      ["MS sliding main gate", 1, "prod-ms-sliding-main-gate"],
      ["MS balcony railing", 40, "prod-ms-balcony-railing"],
    ],
  },
  {
    slug: "terrace-utility-package",
    domainId: "dom-fabrication",
    name: "Terrace Utility Package",
    short: "Spiral staircase with terrace roofing and railing",
    description:
      "Makes a terrace usable: a spiral staircase for access, a roofing structure for shade and rain cover, and a perimeter railing, all designed and fabricated together.",
    price: 285000,
    basis: "per terrace (up to 400 sq.ft)",
    days: 28,
    inclusions: [
      "Spiral staircase with chequered plate treads",
      "Terrace roofing up to 400 sq.ft",
      "Perimeter MS railing up to 60 rft",
    ],
    exclusions: ["Waterproofing", "Flooring", "Electrical work"],
    items: [
      ["Spiral staircase", 1, "prod-spiral-staircase"],
      ["Terrace roofing", 400, "prod-terrace-roofing"],
      ["MS balcony railing", 60, "prod-ms-balcony-railing"],
    ],
  },
  {
    slug: "full-home-repaint-2bhk",
    domainId: "dom-painting",
    name: "2BHK Full Home Repaint",
    short: "Whole flat repainted in five days, furniture covered",
    description:
      "A complete interior repaint of a 2BHK — walls and ceilings, minor putty repair, one primer coat and two coats of premium emulsion, with all furniture covered and the site cleaned each evening. Five working days start to finish.",
    price: 42000,
    basis: "per 2BHK (up to 1000 sq.ft carpet)",
    days: 5,
    inclusions: [
      "All walls and ceilings, two coats",
      "Minor crack filling and sanding",
      "Furniture covering and daily cleaning",
      "Premium emulsion, colour of your choice",
      "2-year warranty",
    ],
    exclusions: ["Full putty work", "Exterior walls", "Wood and metal painting", "Texture finishes"],
    badge: "Most popular",
    featured: true,
    items: [["Interior repainting", 1, "prod-interior-repaint-emulsion"]],
  },
  {
    slug: "full-home-repaint-3bhk",
    domainId: "dom-painting",
    name: "3BHK Full Home Repaint",
    short: "Three-bedroom repaint with one accent wall included",
    description:
      "Interior repaint of a 3BHK with the same process and warranty, including one designer accent wall of your choice in a metallic or stencil finish.",
    price: 62000,
    basis: "per 3BHK (up to 1500 sq.ft carpet)",
    days: 7,
    inclusions: [
      "All walls and ceilings, two coats",
      "One designer accent wall",
      "Minor crack filling and sanding",
      "Furniture covering and daily cleaning",
      "2-year warranty",
    ],
    exclusions: ["Full putty work", "Exterior walls", "Waterproofing"],
    featured: true,
    items: [
      ["Interior repainting", 1, "prod-interior-repaint-emulsion"],
      ["Designer accent wall", 1, "prod-accent-wall-texture"],
    ],
  },
  {
    slug: "monsoon-protection-package",
    domainId: "dom-painting",
    name: "Monsoon Protection Package",
    short: "Exterior painting with terrace waterproofing",
    description:
      "Exterior repainting in a weatherproof system combined with terrace waterproofing, done together before the monsoon so scaffolding and site setup are paid for once rather than twice.",
    price: 185000,
    basis: "per house (2400 sq.ft exterior + 800 sq.ft terrace)",
    days: 14,
    inclusions: [
      "Exterior wall cleaning and crack filling",
      "Apex-grade weatherproof emulsion, two coats",
      "Terrace waterproofing with elastomeric membrane",
      "Scaffolding up to three floors",
      "5-year warranty on both",
    ],
    exclusions: ["Interior painting", "Structural repair", "Drain and downtake replacement"],
    badge: "Seasonal",
    featured: true,
    items: [
      ["Exterior painting", 2400, "prod-exterior-painting-weatherproof"],
      ["Terrace waterproofing", 800, "prod-terrace-waterproofing"],
    ],
  },
  {
    slug: "wood-metal-refresh",
    domainId: "dom-painting",
    name: "Wood & Metal Refresh",
    short: "All doors polished and all grills repainted",
    description:
      "The job everyone postpones: every wooden door and frame polished in melamine or PU, and every grill, gate and railing wire-brushed and repainted in enamel over a rust-inhibiting primer.",
    price: 54000,
    basis: "per house (up to 8 doors + 10 grills)",
    days: 6,
    inclusions: [
      "Polishing of up to 8 doors and frames",
      "Rust removal and repainting of up to 10 grills",
      "Primer plus two finish coats",
      "2-year warranty",
    ],
    exclusions: ["Wall painting", "Furniture polishing", "New fabrication"],
    items: [
      ["Wood PU polishing", 8, "prod-wood-pu-polish"],
      ["Grill and gate painting", 10, "prod-metal-enamel-painting"],
    ],
  },
];

export const servicePackages: ServicePackage[] = seeds.map((s, i) => ({
  ...rec(280 - i * 3, 10),
  id: `pkg-${s.slug}`,
  domainId: s.domainId,
  name: s.name,
  slug: s.slug,
  shortDescription: s.short,
  description: s.description,
  media: phSet(s.domainId.replace("dom-", ""), s.slug, 3),
  price: s.price,
  priceBasis: s.basis,
  durationDays: s.days,
  inclusions: s.inclusions,
  exclusions: s.exclusions,
  isFeatured: s.featured ?? false,
  isActive: true,
  badge: s.badge ?? null,
}));

export const packageItems: PackageItem[] = seeds.flatMap((s) =>
  s.items.map(([label, quantity, productId], i) => ({
    ...rec(280, 10),
    id: `pkgi-${s.slug}-${i}`,
    packageId: `pkg-${s.slug}`,
    productId,
    label,
    quantity,
  })),
);

/**
 * City-wise overrides. Labour and material rates are not uniform, so a handful
 * of products carry an explicit price per city; everything else uses basePrice.
 */
export const productCityPrices: ProductCityPrice[] = [
  { ...rec(200, 20), id: "pcp-1", productId: "prod-interior-repaint-emulsion", cityId: "city-blr", price: 28 },
  { ...rec(200, 20), id: "pcp-2", productId: "prod-interior-repaint-emulsion", cityId: "city-pun", price: 26 },
  { ...rec(200, 20), id: "pcp-3", productId: "prod-interior-repaint-emulsion", cityId: "city-noi", price: 25 },
  { ...rec(200, 20), id: "pcp-4", productId: "prod-sliding-wardrobe-2door", cityId: "city-blr", price: 1680 },
  { ...rec(200, 20), id: "pcp-5", productId: "prod-modular-kitchen-design", cityId: "city-blr", price: 1980 },
  { ...rec(200, 20), id: "pcp-6", productId: "prod-ms-window-grill", cityId: "city-blr", price: 380 },
  { ...rec(200, 20), id: "pcp-7", productId: "prod-ms-sliding-main-gate", cityId: "city-noi", price: 520 },
];
