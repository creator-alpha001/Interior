import type {
  PortfolioItem,
  Professional,
  ProfessionalDomain,
  ProfessionalServiceArea,
  User,
} from "@repo/types";
import { ph, rec } from "./helpers";

interface Seed {
  key: string;
  name: string;
  company: string;
  cityId: string;
  serviceCityIds: string[];
  experience: number;
  completed: number;
  rating: number;
  ratingCount: number;
  languages: string[];
  responseHours: number;
  verification: Professional["verificationStatus"];
  gst: string | null;
  bio: string;
  /** domainId -> [rating, ratingCount, completed, commissionOverride] */
  domains: Record<string, [number, number, number, number | null]>;
  portfolio: Array<{ domainId: string; title: string; description: string; seed: string }>;
}

const seeds: Seed[] = [
  {
    key: "pro-aarohi",
    name: "Aarohi Verma",
    company: "Studio Aarohi Interiors",
    cityId: "city-luc",
    serviceCityIds: ["city-luc", "city-knp"],
    experience: 11,
    completed: 96,
    rating: 4.8,
    ratingCount: 74,
    languages: ["Hindi", "English"],
    responseHours: 2,
    verification: "verified",
    gst: "09AABCS1429P1ZQ",
    bio: "Residential interior practice working across Lucknow and Kanpur since 2015. Known for warm, material-led homes and for finishing on schedule. Handles design, execution and site supervision in-house.",
    domains: {
      "dom-interior": [4.9, 52, 71, null],
      "dom-furniture": [4.6, 22, 25, null],
    },
    portfolio: [
      { domainId: "dom-interior", title: "3BHK at Gomti Nagar", description: "Full home interior in a warm neutral palette with fluted teak accents.", seed: "aarohi-1" },
      { domainId: "dom-interior", title: "Compact 2BHK, Aliganj", description: "Storage-first design for a young family — 41 running feet of concealed storage.", seed: "aarohi-2" },
      { domainId: "dom-furniture", title: "Walk-in wardrobe, Hazratganj", description: "Floor-to-ceiling wardrobe in matte laminate with soft-close hardware.", seed: "aarohi-3" },
    ],
  },
  {
    key: "pro-imran",
    name: "Imran Qureshi",
    company: "Qureshi Design Build",
    cityId: "city-luc",
    serviceCityIds: ["city-luc"],
    experience: 15,
    completed: 141,
    rating: 4.6,
    ratingCount: 108,
    languages: ["Hindi", "Urdu", "English"],
    responseHours: 4,
    verification: "verified",
    gst: "09AADCQ8821L1Z2",
    bio: "Design-build firm with an own carpentry workshop, so interiors and furniture are executed by the same team rather than subcontracted. Strong on turnkey 3BHK and 4BHK projects.",
    domains: {
      "dom-interior": [4.6, 68, 92, null],
      "dom-furniture": [4.7, 40, 49, 7],
    },
    portfolio: [
      { domainId: "dom-interior", title: "Turnkey 4BHK, Sushant Golf City", description: "Complete interiors including false ceiling, lighting and modular kitchen.", seed: "imran-1" },
      { domainId: "dom-furniture", title: "Live-edge dining set", description: "Eight-seater sheesham table with hand-finished live edge.", seed: "imran-2" },
    ],
  },
  {
    key: "pro-nidhi",
    name: "Nidhi Srivastava",
    company: "Casa Nidhi Studio",
    cityId: "city-luc",
    serviceCityIds: ["city-luc", "city-noi"],
    experience: 7,
    completed: 48,
    rating: 4.9,
    ratingCount: 39,
    languages: ["Hindi", "English"],
    responseHours: 1,
    verification: "verified",
    gst: "09AAJCS9911K1ZR",
    bio: "Boutique studio focused on small-footprint homes and rentals. Fast on drawings, and unusually good at working to a fixed budget without the design going flat.",
    domains: { "dom-interior": [4.9, 39, 48, null] },
    portfolio: [
      { domainId: "dom-interior", title: "Rental-ready 2BHK", description: "Durable finishes chosen for a let-out apartment, delivered in 34 days.", seed: "nidhi-1" },
      { domainId: "dom-interior", title: "Studio apartment, Vibhuti Khand", description: "420 sq.ft reworked with a folding partition and a wall bed.", seed: "nidhi-2" },
    ],
  },
  {
    key: "pro-rakesh",
    name: "Rakesh Yadav",
    company: "Yadav Furniture Works",
    cityId: "city-luc",
    serviceCityIds: ["city-luc", "city-knp"],
    experience: 18,
    completed: 210,
    rating: 4.7,
    ratingCount: 156,
    languages: ["Hindi"],
    responseHours: 3,
    verification: "verified",
    gst: null,
    bio: "Third-generation carpentry workshop in Chowk. Solid wood and ply furniture built to measure, with on-site installation by the same carpenters who build it.",
    domains: { "dom-furniture": [4.7, 156, 210, null] },
    portfolio: [
      { domainId: "dom-furniture", title: "Sheesham bed with storage", description: "Queen bed in solid sheesham with hydraulic storage.", seed: "rakesh-1" },
      { domainId: "dom-furniture", title: "Modular TV unit", description: "12 ft wall unit combining open shelving and closed storage.", seed: "rakesh-2" },
      { domainId: "dom-furniture", title: "Study + wardrobe combo", description: "Space-saving unit for a child's room, 8 ft x 7 ft.", seed: "rakesh-3" },
    ],
  },
  {
    key: "pro-sunita",
    name: "Sunita Rawat",
    company: "Rawat Modular",
    cityId: "city-luc",
    serviceCityIds: ["city-luc"],
    experience: 9,
    completed: 132,
    rating: 4.5,
    ratingCount: 97,
    languages: ["Hindi", "English"],
    responseHours: 5,
    verification: "verified",
    gst: "09AAKCR3390M1ZX",
    bio: "Factory-made modular furniture with a 7-day installation promise. Works with Century and Greenply boards and Hettich hardware as standard.",
    domains: { "dom-furniture": [4.5, 97, 132, null] },
    portfolio: [
      { domainId: "dom-furniture", title: "L-shaped modular kitchen", description: "Acrylic-finish shutters with tandem baskets.", seed: "sunita-1" },
      { domainId: "dom-furniture", title: "Sliding wardrobe, 9 ft", description: "Mirror-front sliding wardrobe with internal drawers.", seed: "sunita-2" },
    ],
  },
  {
    key: "pro-devendra",
    name: "Devendra Singh",
    company: "Singh Steel & Fabrication",
    cityId: "city-luc",
    serviceCityIds: ["city-luc", "city-knp"],
    experience: 22,
    completed: 380,
    rating: 4.6,
    ratingCount: 201,
    languages: ["Hindi"],
    responseHours: 3,
    verification: "verified",
    gst: "09AACFS7712J1ZP",
    bio: "Heavy fabrication workshop handling gates, railings, sheds and industrial structures. Own powder-coating setup, which keeps finish quality consistent.",
    domains: {
      "dom-fabrication": [4.6, 201, 380, null],
      "dom-painting": [4.2, 18, 26, null],
    },
    portfolio: [
      { domainId: "dom-fabrication", title: "MS main gate with laser-cut panel", description: "14 ft sliding gate, powder-coated, with a custom cut pattern.", seed: "devendra-1" },
      { domainId: "dom-fabrication", title: "SS staircase railing", description: "304-grade stainless railing with toughened glass infill.", seed: "devendra-2" },
    ],
  },
  {
    key: "pro-arif",
    name: "Mohd Arif",
    company: "Arif Iron Works",
    cityId: "city-luc",
    serviceCityIds: ["city-luc"],
    experience: 13,
    completed: 245,
    rating: 4.4,
    ratingCount: 132,
    languages: ["Hindi", "Urdu"],
    responseHours: 6,
    verification: "verified",
    gst: null,
    bio: "Grills, security doors and window frames at competitive rates. Best suited to straightforward MS work where price matters more than bespoke design.",
    domains: { "dom-fabrication": [4.4, 132, 245, 5] },
    portfolio: [
      { domainId: "dom-fabrication", title: "Window grills, full house", description: "11 windows in MS square pipe with enamel finish.", seed: "arif-1" },
      { domainId: "dom-fabrication", title: "Terrace shed", description: "Polycarbonate roofing on an MS frame, 320 sq.ft.", seed: "arif-2" },
    ],
  },
  {
    key: "pro-vinod",
    name: "Vinod Kumar",
    company: "Sri Balaji Fabricators",
    cityId: "city-luc",
    serviceCityIds: ["city-luc", "city-noi"],
    experience: 16,
    completed: 190,
    rating: 4.7,
    ratingCount: 118,
    languages: ["Hindi", "English"],
    responseHours: 2,
    verification: "verified",
    gst: "09AAGFS2204N1ZD",
    bio: "Specialises in stainless steel and aluminium — railings, glass-and-steel canopies and ACP cladding. Takes on design-led work other fabricators decline.",
    domains: { "dom-fabrication": [4.7, 118, 190, null] },
    portfolio: [
      { domainId: "dom-fabrication", title: "Glass and steel canopy", description: "Front porch canopy in SS with 12 mm toughened glass.", seed: "vinod-1" },
      { domainId: "dom-fabrication", title: "Balcony railing, 60 rft", description: "Slim-profile SS railing across three balconies.", seed: "vinod-2" },
    ],
  },
  {
    key: "pro-santosh",
    name: "Santosh Painter",
    company: "Colour Craft Painting Co.",
    cityId: "city-luc",
    serviceCityIds: ["city-luc", "city-knp"],
    experience: 12,
    completed: 305,
    rating: 4.8,
    ratingCount: 187,
    languages: ["Hindi"],
    responseHours: 2,
    verification: "verified",
    gst: "09AAMCC5518Q1ZL",
    bio: "Full-service painting crew of 14. Asian Paints and Birla Opus applicator, with proper surface prep and site covering as standard rather than an extra.",
    domains: { "dom-painting": [4.8, 187, 305, null] },
    portfolio: [
      { domainId: "dom-painting", title: "3BHK repaint in 5 days", description: "Royale Aspira interiors with two accent walls.", seed: "santosh-1" },
      { domainId: "dom-painting", title: "Exterior + waterproofing", description: "Apex Ultima exterior with terrace waterproofing, 2400 sq.ft.", seed: "santosh-2" },
    ],
  },
  {
    key: "pro-jyoti",
    name: "Jyoti Enterprises",
    company: "Jyoti Paints & Waterproofing",
    cityId: "city-luc",
    serviceCityIds: ["city-luc"],
    experience: 8,
    completed: 164,
    rating: 4.5,
    ratingCount: 121,
    languages: ["Hindi", "English"],
    responseHours: 4,
    verification: "verified",
    gst: "09AAHCJ6620R1ZB",
    bio: "Painting and waterproofing contractor. Strong on texture and stencil finishes, and the only vendor on the platform offering a written 7-year exterior warranty.",
    domains: { "dom-painting": [4.5, 121, 164, null] },
    portfolio: [
      { domainId: "dom-painting", title: "Textured feature wall", description: "Metallic travertine texture across a 9 ft living room wall.", seed: "jyoti-1" },
      { domainId: "dom-painting", title: "Terrace waterproofing", description: "Two-coat elastomeric membrane with a 7-year warranty.", seed: "jyoti-2" },
    ],
  },
  {
    key: "pro-harpreet",
    name: "Harpreet Kaur",
    company: "Nook & Grain",
    cityId: "city-blr",
    serviceCityIds: ["city-blr"],
    experience: 6,
    completed: 37,
    rating: 4.7,
    ratingCount: 28,
    languages: ["English", "Hindi", "Punjabi"],
    responseHours: 3,
    verification: "verified",
    gst: "29AAECN1180T1ZY",
    bio: "Bengaluru studio doing interiors and bespoke furniture for apartments. Detail-heavy, with a preference for solid wood over engineered board wherever budget allows.",
    domains: {
      "dom-interior": [4.7, 18, 24, null],
      "dom-furniture": [4.8, 10, 13, null],
    },
    portfolio: [
      { domainId: "dom-interior", title: "2BHK, Whitefield", description: "Muted palette with cane and rattan detailing.", seed: "harpreet-1" },
    ],
  },
  {
    key: "pro-ganesh",
    name: "Ganesh Patil",
    company: "Patil Painting Services",
    cityId: "city-pun",
    serviceCityIds: ["city-pun"],
    experience: 10,
    completed: 198,
    rating: 4.4,
    ratingCount: 143,
    languages: ["Marathi", "Hindi", "English"],
    responseHours: 5,
    verification: "pending",
    gst: null,
    bio: "Pune-based painting contractor covering societies and independent bungalows. Currently completing platform verification.",
    domains: { "dom-painting": [4.4, 143, 198, null] },
    portfolio: [],
  },
];

export const professionalUsers: User[] = seeds.map((s, i) => ({
  ...rec(300 - i * 5, 3),
  id: `user-${s.key}`,
  name: s.name,
  mobile: `98${String(10_000_000 + i * 13_579).slice(0, 8)}`,
  email: `${s.key.replace("pro-", "")}@example.com`,
  role: "professional" as const,
  cityId: s.cityId,
  status: "active" as const,
  avatarUrl: null,
}));

export const professionals: Professional[] = seeds.map((s, i) => ({
  ...rec(300 - i * 5, 3),
  id: s.key,
  userId: `user-${s.key}`,
  companyName: s.company,
  gstNumber: s.gst,
  experienceYears: s.experience,
  bio: s.bio,
  avgRating: s.rating,
  ratingCount: s.ratingCount,
  completedProjects: s.completed,
  languages: s.languages,
  verificationStatus: s.verification,
  avgResponseHours: s.responseHours,
}));

export const professionalDomains: ProfessionalDomain[] = seeds.flatMap((s) =>
  Object.entries(s.domains).map(([domainId, [rating, count, completed, override]]) => ({
    ...rec(300, 3),
    id: `pd-${s.key}-${domainId}`,
    professionalId: s.key,
    domainId,
    verificationStatus:
      s.verification === "verified" ? ("approved" as const) : ("pending" as const),
    commissionPercentOverride: override,
    avgRating: rating,
    ratingCount: count,
    completedProjects: completed,
  })),
);

export const professionalServiceAreas: ProfessionalServiceArea[] = seeds.flatMap((s) =>
  s.serviceCityIds.map((cityId) => ({
    ...rec(300, 3),
    id: `psa-${s.key}-${cityId}`,
    professionalId: s.key,
    cityId,
    localities: [],
  })),
);

export const portfolioItems: PortfolioItem[] = seeds.flatMap((s) =>
  s.portfolio.map((p) => ({
    ...rec(200, 20),
    id: `pf-${p.seed}`,
    professionalId: s.key,
    domainId: p.domainId,
    title: p.title,
    description: p.description,
    media: [ph(p.domainId.replace("dom-", ""), p.seed, p.title)],
    moderationStatus: "approved" as const,
  })),
);
