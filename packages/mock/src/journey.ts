import type {
  Agreement,
  AgreementLeadDomain,
  Client,
  CommissionInvoice,
  Lead,
  LeadDomain,
  LeadDomainAssignment,
  LeadDomainItem,
  LeadSalesActivity,
  Meeting,
  Message,
  Notification,
  Project,
  Quote,
  QuoteLineItem,
  Referral,
  Review,
  SalesAgent,
  SupportTicket,
  User,
} from "@repo/types";
import { dateOnly, daysAgo, daysAhead, phSet, rec } from "./helpers";

/* ------------------------------------------------------------------ *
 * Clients
 * ------------------------------------------------------------------ */

interface ClientSeed {
  key: string;
  name: string;
  mobile: string;
  email: string;
  cityId: string;
  address: string;
}

const clientSeeds: ClientSeed[] = [
  {
    key: "priya",
    name: "Priya Sharma",
    mobile: "9839012477",
    email: "priya.sharma@example.com",
    cityId: "city-luc",
    address: "B-402, Eldeco Elegance, Vibhuti Khand, Gomti Nagar, Lucknow 226010",
  },
  {
    key: "rohit",
    name: "Rohit Malhotra",
    mobile: "9838220145",
    email: "rohit.malhotra@example.com",
    cityId: "city-luc",
    address: "House 27, Sector C, Sushant Golf City, Lucknow 226030",
  },
  {
    key: "anjali",
    name: "Anjali Gupta",
    mobile: "9451188206",
    email: "anjali.gupta@example.com",
    cityId: "city-luc",
    address: "14/3 Nirala Nagar, Lucknow 226020",
  },
  {
    key: "meera",
    name: "Meera Joshi",
    mobile: "9919344871",
    email: "meera.joshi@example.com",
    cityId: "city-luc",
    address: "C-11, Indira Nagar Sector 14, Lucknow 226016",
  },
  {
    key: "vikram",
    name: "Vikram Nair",
    mobile: "9455670092",
    email: "vikram.nair@example.com",
    cityId: "city-luc",
    address: "Flat 8B, Rohtas Plumeria, Gomti Nagar Extension, Lucknow 226010",
  },
  {
    key: "sameer",
    name: "Sameer Ahmad",
    mobile: "9026781134",
    email: "sameer.ahmad@example.com",
    cityId: "city-luc",
    address: "Old Hyderabad, Near Chowk, Lucknow 226003",
  },
];

export const clientUsers: User[] = clientSeeds.map((c, i) => ({
  ...rec(200 - i * 12, 2),
  id: `user-client-${c.key}`,
  name: c.name,
  mobile: c.mobile,
  email: c.email,
  role: "client" as const,
  cityId: c.cityId,
  status: "active" as const,
  avatarUrl: null,
}));

export const clients: Client[] = clientSeeds.map((c, i) => ({
  ...rec(200 - i * 12, 2),
  id: `client-${c.key}`,
  userId: `user-client-${c.key}`,
  address: c.address,
  referralCode: `${(c.name.split(" ")[0] ?? c.name).toUpperCase()}${1000 + i * 7}`,
  referredByUserId: c.key === "sameer" ? "user-client-priya" : null,
}));

/** The client the demo signs in as. */
export const demoClientId = "client-priya";

/* ------------------------------------------------------------------ *
 * Sales agents
 * ------------------------------------------------------------------ */

export const salesUsers: User[] = [
  {
    ...rec(250, 5),
    id: "user-sales-kavita",
    name: "Kavita Bisht",
    mobile: "9120045566",
    email: "kavita@example.com",
    role: "sales_agent",
    cityId: "city-luc",
    status: "active",
    avatarUrl: null,
  },
  {
    ...rec(250, 5),
    id: "user-sales-amit",
    name: "Amit Tiwari",
    mobile: "9120045577",
    email: "amit@example.com",
    role: "sales_agent",
    cityId: "city-luc",
    status: "active",
    avatarUrl: null,
  },
];

export const salesAgents: SalesAgent[] = [
  { ...rec(250, 5), id: "sales-kavita", userId: "user-sales-kavita", assignedCityIds: ["city-luc"], dailyTarget: 12 },
  { ...rec(250, 5), id: "sales-amit", userId: "user-sales-amit", assignedCityIds: ["city-luc", "city-knp"], dailyTarget: 12 },
];

export const adminUsers: User[] = [
  {
    ...rec(400, 1),
    id: "user-admin",
    name: "Neha Bajpai",
    mobile: "9000000001",
    email: "admin@example.com",
    role: "admin",
    cityId: "city-luc",
    status: "active",
    avatarUrl: null,
  },
];

/* ------------------------------------------------------------------ *
 * Quote helper — keeps subtotal / tax / total arithmetically consistent
 * ------------------------------------------------------------------ */

interface QuoteSeed {
  id: string;
  leadDomainId: string;
  professionalId: string;
  createdDaysAgo: number;
  timelineDays: number;
  warrantyMonths: number;
  warrantyDetails: string;
  materialsSummary: string;
  status: Quote["status"];
  taxPercent?: number;
  version?: number;
  supersedes?: string | null;
  notes?: string;
  lines: Array<[description: string, quantity: number, unit: string, rate: number]>;
}

function mkQuote(s: QuoteSeed): Quote {
  const lineItems: QuoteLineItem[] = s.lines.map(([description, quantity, unit, rate], i) => ({
    id: `${s.id}-li-${i + 1}`,
    description,
    quantity,
    unit,
    rate,
    amount: Math.round(quantity * rate),
  }));
  const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0);
  const taxPercent = s.taxPercent ?? 18;
  const taxAmount = Math.round((subtotal * taxPercent) / 100);
  return {
    ...rec(s.createdDaysAgo, s.createdDaysAgo),
    id: s.id,
    leadDomainId: s.leadDomainId,
    professionalId: s.professionalId,
    version: s.version ?? 1,
    supersedesQuoteId: s.supersedes ?? null,
    lineItems,
    subtotal,
    taxPercent,
    taxAmount,
    total: subtotal + taxAmount,
    timelineDays: s.timelineDays,
    warrantyMonths: s.warrantyMonths,
    warrantyDetails: s.warrantyDetails,
    materialsSummary: s.materialsSummary,
    boqUrl: `/mock/boq/${s.id}.pdf`,
    quotePdfUrl: `/mock/quotes/${s.id}.pdf`,
    status: s.status,
    notes: s.notes ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

export const leads: Lead[] = [
  {
    ...rec(9, 1),
    id: "lead-1042",
    reference: "LD-1042",
    clientId: "client-priya",
    cityId: "city-luc",
    description:
      "Need a wardrobe and a bed for the master bedroom, and the whole 2BHK repainted. I already have the plywood for the wardrobe from an earlier plan that fell through.",
    urgency: "immediate",
    budgetMin: 150000,
    budgetMax: 300000,
    siteAccessibilityTags: ["lift", "parking", "timing_restriction"],
    photos: [],
    source: "app",
    overallStatus: "in_progress",
    assignedSalesAgentId: "sales-kavita",
  },
  {
    ...rec(96, 12),
    id: "lead-1017",
    reference: "LD-1017",
    clientId: "client-priya",
    cityId: "city-luc",
    description:
      "Full interiors for a 3BHK in Sushant Golf City — kitchen, wardrobes, ceiling. Also want the dining table and TV unit made by the same team so everything matches.",
    urgency: "within_month",
    budgetMin: 1000000,
    budgetMax: 1600000,
    siteAccessibilityTags: ["parking"],
    photos: [],
    source: "website",
    overallStatus: "in_progress",
    assignedSalesAgentId: "sales-amit",
  },
  {
    ...rec(3, 1),
    id: "lead-1055",
    reference: "LD-1055",
    clientId: "client-anjali",
    cityId: "city-luc",
    description:
      "Ground floor house — need a safety door and grills on all windows. Saw the Home Security Package on the site, roughly that scope.",
    urgency: "immediate",
    budgetMin: 60000,
    budgetMax: 100000,
    siteAccessibilityTags: ["parking"],
    photos: [],
    source: "catalogue",
    overallStatus: "verified",
    assignedSalesAgentId: "sales-kavita",
  },
  {
    ...rec(54, 6),
    id: "lead-1031",
    reference: "LD-1031",
    clientId: "client-priya",
    cityId: "city-luc",
    description:
      "House needs exterior painting before the rains, and a new balcony railing on the first floor. Two separate things but wanted to sort both together.",
    urgency: "immediate",
    budgetMin: 200000,
    budgetMax: 350000,
    siteAccessibilityTags: ["parking", "other"],
    photos: [],
    source: "referral",
    overallStatus: "in_progress",
    assignedSalesAgentId: "sales-amit",
  },
  {
    ...rec(140, 40),
    id: "lead-0994",
    reference: "LD-0994",
    clientId: "client-vikram",
    cityId: "city-luc",
    description: "2BHK flat repaint before we move in. Nothing fancy, just clean walls and ceilings.",
    urgency: "immediate",
    budgetMin: 35000,
    budgetMax: 60000,
    siteAccessibilityTags: ["lift"],
    photos: [],
    source: "app",
    overallStatus: "closed",
    assignedSalesAgentId: "sales-kavita",
  },
  {
    ...rec(0, 0),
    id: "lead-1061",
    reference: "LD-1061",
    clientId: "client-sameer",
    cityId: "city-luc",
    description: "Just need a dining table, 6 seater, solid wood if possible. Nothing else for now.",
    urgency: "exploring",
    budgetMin: 40000,
    budgetMax: 80000,
    siteAccessibilityTags: ["lift"],
    photos: [],
    source: "app",
    overallStatus: "in_progress",
    assignedSalesAgentId: "sales-amit",
  },
];

/* ------------------------------------------------------------------ *
 * Lead domains — one row per service inside a requirement
 * ------------------------------------------------------------------ */

export const leadDomains: LeadDomain[] = [
  // LD-1042: Furniture + Painting. Material source differs per domain, which is
  // the whole point of tracking it here rather than on the lead.
  {
    ...rec(9, 1),
    id: "ldom-1042-furniture",
    leadId: "lead-1042",
    domainId: "dom-furniture",
    materialSource: "customer_supplied",
    status: "quoted",
    preferredProfessionalId: null,
    preferenceUnmetReason: null,
    selectedProfessionalId: null,
    selectedQuoteId: null,
  },
  {
    ...rec(9, 1),
    id: "ldom-1042-painting",
    leadId: "lead-1042",
    domainId: "dom-painting",
    materialSource: "vendor_supplied",
    status: "quoted",
    // Client browsed and asked for Jyoti; they were available, so we included them.
    preferredProfessionalId: "pro-jyoti",
    preferenceUnmetReason: null,
    selectedProfessionalId: null,
    selectedQuoteId: null,
  },

  // LD-1017: same professional selected for both domains -> ONE combined agreement.
  {
    ...rec(96, 12),
    id: "ldom-1017-interior",
    leadId: "lead-1017",
    domainId: "dom-interior",
    materialSource: "vendor_supplied",
    status: "in_progress",
    preferredProfessionalId: null,
    preferenceUnmetReason: null,
    selectedProfessionalId: "pro-aarohi",
    selectedQuoteId: "q-1017-int-aarohi",
  },
  {
    ...rec(96, 12),
    id: "ldom-1017-furniture",
    leadId: "lead-1017",
    domainId: "dom-furniture",
    materialSource: "vendor_supplied",
    status: "in_progress",
    preferredProfessionalId: null,
    preferenceUnmetReason: null,
    selectedProfessionalId: "pro-aarohi",
    selectedQuoteId: "q-1017-fur-aarohi",
  },

  // LD-1055: catalogue-sourced fabrication lead, awaiting assignment.
  {
    ...rec(3, 1),
    id: "ldom-1055-fabrication",
    leadId: "lead-1055",
    domainId: "dom-fabrication",
    materialSource: "vendor_supplied",
    status: "pending_assignment",
    // Asked for by name, but they cannot take it — the client is told, plainly.
    preferredProfessionalId: "pro-devendra",
    preferenceUnmetReason:
      "Booked through to mid-October and could not take a job starting this month.",
    selectedProfessionalId: null,
    selectedQuoteId: null,
  },

  // LD-1031: different professionals per domain -> TWO separate agreements.
  {
    ...rec(54, 6),
    id: "ldom-1031-painting",
    leadId: "lead-1031",
    domainId: "dom-painting",
    materialSource: "vendor_supplied",
    status: "in_progress",
    preferredProfessionalId: null,
    preferenceUnmetReason: null,
    selectedProfessionalId: "pro-santosh",
    selectedQuoteId: "q-1031-pnt-santosh",
  },
  {
    ...rec(54, 6),
    id: "ldom-1031-fabrication",
    leadId: "lead-1031",
    domainId: "dom-fabrication",
    materialSource: "vendor_supplied",
    status: "vendor_selected",
    preferredProfessionalId: null,
    preferenceUnmetReason: null,
    selectedProfessionalId: "pro-vinod",
    selectedQuoteId: "q-1031-fab-vinod",
  },

  // LD-0994: completed painting job with a review.
  {
    ...rec(140, 40),
    id: "ldom-0994-painting",
    leadId: "lead-0994",
    domainId: "dom-painting",
    materialSource: "vendor_supplied",
    status: "completed",
    preferredProfessionalId: null,
    preferenceUnmetReason: null,
    selectedProfessionalId: "pro-santosh",
    selectedQuoteId: "q-0994-pnt-santosh",
  },

  // LD-1061: brand new, untouched.
  {
    ...rec(0, 0),
    id: "ldom-1061-furniture",
    leadId: "lead-1061",
    domainId: "dom-furniture",
    materialSource: "vendor_supplied",
    status: "assigned",
    preferredProfessionalId: null,
    preferenceUnmetReason: null,
    selectedProfessionalId: null,
    selectedQuoteId: null,
  },
];

/** Catalogue selections carried into a lead. */
export const leadDomainItems: LeadDomainItem[] = [
  {
    ...rec(3, 3),
    id: "ldi-1055-1",
    leadDomainId: "ldom-1055-fabrication",
    productId: null,
    packageId: "pkg-home-security-fabrication",
    itemName: "Home Security Package",
    quantity: 1,
    selectedOptions: {},
    indicativePrice: 78000,
    customerNotes: "House has 9 windows, one more than the package covers.",
  },
  {
    ...rec(9, 9),
    id: "ldi-1042-1",
    leadDomainId: "ldom-1042-furniture",
    productId: "prod-sliding-wardrobe-2door",
    packageId: null,
    itemName: "2-Door Sliding Wardrobe",
    quantity: 1,
    selectedOptions: { "Shutter finish": "Laminate", Loft: "Add loft storage" },
    indicativePrice: 1450,
    customerNotes: "Wall is 7 ft wide, ceiling 10 ft. I have the ply already.",
  },
  {
    ...rec(9, 9),
    id: "ldi-1042-2",
    leadDomainId: "ldom-1042-furniture",
    productId: "prod-queen-bed-storage",
    packageId: null,
    itemName: "Queen Bed with Hydraulic Storage",
    quantity: 1,
    selectedOptions: { Size: "Queen 60x78", Headboard: "Fabric upholstered" },
    indicativePrice: 47500,
    customerNotes: null,
  },
];

/* ------------------------------------------------------------------ *
 * Assignments — three professionals per lead-domain, assigned by admin
 * ------------------------------------------------------------------ */

function assign(
  id: string,
  leadDomainId: string,
  professionalId: string,
  responseStatus: LeadDomainAssignment["responseStatus"],
  assignedDaysAgo: number,
  respondedDaysAgo: number | null,
  rejectionReason: string | null = null,
): LeadDomainAssignment {
  return {
    ...rec(assignedDaysAgo, respondedDaysAgo ?? assignedDaysAgo),
    id,
    leadDomainId,
    professionalId,
    responseStatus,
    assignedAt: daysAgo(assignedDaysAgo),
    respondedAt: respondedDaysAgo === null ? null : daysAgo(respondedDaysAgo),
    rejectionReason,
  };
}

export const leadDomainAssignments: LeadDomainAssignment[] = [
  assign("asg-1042-f1", "ldom-1042-furniture", "pro-rakesh", "accepted", 7, 7),
  assign("asg-1042-f2", "ldom-1042-furniture", "pro-sunita", "accepted", 7, 6),
  assign("asg-1042-f3", "ldom-1042-furniture", "pro-imran", "accepted", 7, 6),
  assign("asg-1042-p1", "ldom-1042-painting", "pro-santosh", "accepted", 7, 7),
  assign("asg-1042-p2", "ldom-1042-painting", "pro-jyoti", "accepted", 7, 6),
  assign("asg-1042-p3", "ldom-1042-painting", "pro-devendra", "accepted", 7, 5),

  assign("asg-1017-i1", "ldom-1017-interior", "pro-aarohi", "accepted", 92, 92),
  assign("asg-1017-i2", "ldom-1017-interior", "pro-imran", "accepted", 92, 91),
  assign("asg-1017-i3", "ldom-1017-interior", "pro-nidhi", "rejected", 92, 90, "Booked through the quarter"),
  assign("asg-1017-f1", "ldom-1017-furniture", "pro-aarohi", "accepted", 92, 92),
  assign("asg-1017-f2", "ldom-1017-furniture", "pro-rakesh", "accepted", 92, 91),

  assign("asg-1031-p1", "ldom-1031-painting", "pro-santosh", "accepted", 50, 50),
  assign("asg-1031-p2", "ldom-1031-painting", "pro-jyoti", "accepted", 50, 49),
  assign("asg-1031-b1", "ldom-1031-fabrication", "pro-vinod", "accepted", 50, 49),
  assign("asg-1031-b2", "ldom-1031-fabrication", "pro-devendra", "accepted", 50, 48),

  assign("asg-1061-f1", "ldom-1061-furniture", "pro-aarohi", "accepted", 1, 1),
  assign("asg-1061-f2", "ldom-1061-furniture", "pro-rakesh", "accepted", 1, 1),
  assign("asg-1061-f3", "ldom-1061-furniture", "pro-sunita", "accepted", 1, 0),

  assign("asg-0994-p1", "ldom-0994-painting", "pro-santosh", "accepted", 136, 136),
  assign("asg-0994-p2", "ldom-0994-painting", "pro-jyoti", "accepted", 136, 135),
];

/* ------------------------------------------------------------------ *
 * Quotes
 * ------------------------------------------------------------------ */

export const quotes: Quote[] = [
  /* --- LD-1042 Furniture: client supplies the ply, so these are labour-led --- */
  mkQuote({
    id: "q-1042-fur-rakesh",
    leadDomainId: "ldom-1042-furniture",
    professionalId: "pro-rakesh",
    createdDaysAgo: 4,
    timelineDays: 18,
    warrantyMonths: 36,
    warrantyDetails: "3 years on workmanship. Hardware carries the manufacturer's 1-year warranty.",
    materialsSummary:
      "Customer-supplied 16 mm ply. We provide Hettich soft-close hardware, 1 mm laminate and edge banding.",
    status: "submitted",
    notes: "Labour-only rate since you are supplying the board. Loft included in the wardrobe area.",
    lines: [
      ["Sliding wardrobe — carpentry labour (7 x 10 ft incl. loft)", 70, "sq.ft", 620],
      ["Laminate and edge banding", 70, "sq.ft", 145],
      ["Hettich sliding channel and internal hardware", 1, "set", 11500],
      ["Queen bed with hydraulic storage — labour and hardware", 1, "piece", 21000],
      ["Fabric headboard upholstery", 1, "piece", 5200],
    ],
  }),
  mkQuote({
    id: "q-1042-fur-sunita",
    leadDomainId: "ldom-1042-furniture",
    professionalId: "pro-sunita",
    createdDaysAgo: 3,
    timelineDays: 12,
    warrantyMonths: 60,
    warrantyDetails: "5 years on carcass workmanship, 2 years on Hettich hardware.",
    materialsSummary:
      "Customer-supplied ply used for the carcass. Factory-cut and edge-banded, Hettich Quadro channels.",
    status: "submitted",
    notes: "Factory production, so installation is 2 days on site. Fastest of the three.",
    lines: [
      ["Sliding wardrobe — factory cutting, edge banding, assembly", 70, "sq.ft", 700],
      ["Laminate (Merino / Century)", 70, "sq.ft", 165],
      ["Hettich Quadro sliding system", 1, "set", 14200],
      ["Queen bed with hydraulic storage", 1, "piece", 24500],
      ["Site installation and finishing", 1, "lot", 6500],
    ],
  }),
  mkQuote({
    id: "q-1042-fur-imran",
    leadDomainId: "ldom-1042-furniture",
    professionalId: "pro-imran",
    createdDaysAgo: 3,
    timelineDays: 22,
    warrantyMonths: 60,
    warrantyDetails: "5 years on workmanship including hardware replacement in the first year.",
    materialsSummary:
      "Customer ply for carcass; we upgrade shutters to 18 mm HDHMR at our cost for a flatter finish.",
    status: "submitted",
    notes: "Includes a design drawing and 3D view of the wardrobe elevation before we start cutting.",
    lines: [
      ["Wardrobe design, elevation and 3D view", 1, "lot", 6000],
      ["Sliding wardrobe — carpentry (7 x 10 ft incl. loft)", 70, "sq.ft", 690],
      ["Shutter upgrade to 18 mm HDHMR with laminate", 70, "sq.ft", 190],
      ["Ebco sliding system", 1, "set", 9800],
      ["Queen bed with hydraulic storage, upholstered headboard", 1, "piece", 27500],
    ],
  }),

  /* --- LD-1042 Painting: vendor supplies material --- */
  mkQuote({
    id: "q-1042-pnt-santosh",
    leadDomainId: "ldom-1042-painting",
    professionalId: "pro-santosh",
    createdDaysAgo: 4,
    timelineDays: 5,
    warrantyMonths: 24,
    warrantyDetails: "2 years against peeling and flaking. Free touch-up visit at 6 months.",
    materialsSummary: "Asian Paints Royale Aspira, 1 coat primer + 2 finish coats. Birla putty for repairs.",
    status: "submitted",
    notes: "Furniture covering, daily cleaning and hardware refitting included. Crew of 4, 5 working days.",
    lines: [
      ["Wall and ceiling painting — 2 coats Royale Aspira", 3200, "sq.ft", 32],
      ["Minor crack filling, putty repair and sanding", 1, "lot", 4500],
      ["Furniture covering and daily site cleaning", 1, "lot", 2500],
    ],
  }),
  mkQuote({
    id: "q-1042-pnt-jyoti",
    leadDomainId: "ldom-1042-painting",
    professionalId: "pro-jyoti",
    createdDaysAgo: 3,
    timelineDays: 6,
    warrantyMonths: 36,
    warrantyDetails: "3 years against peeling. One free repaint of any affected wall within the period.",
    materialsSummary: "Birla Opus Ultra Sheen with 2 coats putty on the two damp-affected walls.",
    status: "submitted",
    notes: "Includes proper putty work on the two walls behind the kitchen, which the others have not priced.",
    lines: [
      ["Wall and ceiling painting — 2 coats premium emulsion", 3200, "sq.ft", 27],
      ["Two coats putty with sanding — kitchen and utility walls", 420, "sq.ft", 22],
      ["Damp patch treatment behind kitchen wall", 1, "lot", 6800],
      ["Covering, masking and cleaning", 1, "lot", 2200],
    ],
  }),
  mkQuote({
    id: "q-1042-pnt-devendra",
    leadDomainId: "ldom-1042-painting",
    professionalId: "pro-devendra",
    createdDaysAgo: 2,
    timelineDays: 7,
    warrantyMonths: 12,
    warrantyDetails: "1 year on workmanship.",
    materialsSummary: "Asian Paints Premium Emulsion, 2 coats over existing putty.",
    status: "submitted",
    notes: "Lowest price. No putty rework included — walls to be handed over in paintable condition.",
    lines: [
      ["Wall and ceiling painting — 2 coats premium emulsion", 3200, "sq.ft", 22],
      ["Minor touch-up filling", 1, "lot", 2000],
    ],
  }),

  /* --- LD-1017: combined agreement (same professional, two domains) --- */
  mkQuote({
    id: "q-1017-int-aarohi",
    leadDomainId: "ldom-1017-interior",
    professionalId: "pro-aarohi",
    createdDaysAgo: 84,
    timelineDays: 75,
    warrantyMonths: 60,
    warrantyDetails: "5 years on carcass, 1 year on electrical and services.",
    materialsSummary: "Century BWP marine ply, Merino laminate, Hettich hardware, quartz counter.",
    status: "selected",
    lines: [
      ["Modular kitchen — marine ply carcass, acrylic shutters", 105, "sq.ft", 2150],
      ["Wardrobes — three bedrooms", 210, "sq.ft", 1550],
      ["False ceiling with cove and profile lighting", 900, "sq.ft", 128],
      ["TV wall panelling — fluted with backlit profile", 84, "sq.ft", 1450],
      ["Design, drawings, 3D views and site supervision", 1, "lot", 95000],
    ],
  }),
  mkQuote({
    id: "q-1017-fur-aarohi",
    leadDomainId: "ldom-1017-furniture",
    professionalId: "pro-aarohi",
    createdDaysAgo: 84,
    timelineDays: 30,
    warrantyMonths: 36,
    warrantyDetails: "3 years on workmanship and finish.",
    materialsSummary: "Solid sheesham dining table, ply and veneer TV console, matched PU finish.",
    status: "selected",
    lines: [
      ["6-seater dining table — solid sheesham", 1, "piece", 62000],
      ["Dining chairs — upholstered", 6, "piece", 7200],
      ["Crockery unit with lit display", 34, "sq.ft", 1380],
    ],
  }),
  mkQuote({
    id: "q-1017-int-imran",
    leadDomainId: "ldom-1017-interior",
    professionalId: "pro-imran",
    createdDaysAgo: 85,
    timelineDays: 68,
    warrantyMonths: 60,
    warrantyDetails: "5 years on carcass.",
    materialsSummary: "Greenply BWP, membrane shutters, Ebco hardware.",
    status: "rejected",
    lines: [
      ["Modular kitchen — membrane shutters", 105, "sq.ft", 1880],
      ["Wardrobes — three bedrooms", 210, "sq.ft", 1420],
      ["False ceiling with lighting", 900, "sq.ft", 112],
      ["Design and supervision", 1, "lot", 70000],
    ],
  }),

  /* --- LD-1031: separate agreements (different professionals per domain) --- */
  mkQuote({
    id: "q-1031-pnt-santosh",
    leadDomainId: "ldom-1031-painting",
    professionalId: "pro-santosh",
    createdDaysAgo: 45,
    timelineDays: 12,
    warrantyMonths: 60,
    warrantyDetails: "5 years on exterior coating.",
    materialsSummary: "Asian Paints Apex Ultima with acrylic crack filler; scaffolding included.",
    status: "selected",
    lines: [
      ["Exterior painting — Apex Ultima, 2 coats", 2400, "sq.ft", 48],
      ["Crack filling and surface preparation", 1, "lot", 18000],
      ["Scaffolding and access — up to 3 floors", 1, "lot", 22000],
    ],
  }),
  mkQuote({
    id: "q-1031-fab-vinod",
    leadDomainId: "ldom-1031-fabrication",
    professionalId: "pro-vinod",
    createdDaysAgo: 44,
    timelineDays: 16,
    warrantyMonths: 36,
    warrantyDetails: "3 years on fabrication and finish.",
    materialsSummary: "SS 304 slim-profile railing with 12 mm toughened glass infill.",
    status: "selected",
    lines: [
      ["SS 304 balcony railing with glass infill", 46, "running ft", 2380],
      ["Site measurement, fabrication and installation", 1, "lot", 12000],
    ],
  }),

  /* --- LD-0994: completed painting job --- */
  mkQuote({
    id: "q-0994-pnt-santosh",
    leadDomainId: "ldom-0994-painting",
    professionalId: "pro-santosh",
    createdDaysAgo: 132,
    timelineDays: 5,
    warrantyMonths: 24,
    warrantyDetails: "2 years against peeling.",
    materialsSummary: "Asian Paints Premium Emulsion, 2 coats.",
    status: "selected",
    lines: [
      ["Interior repainting — 2BHK, walls and ceilings", 3100, "sq.ft", 24],
      ["Minor repair and covering", 1, "lot", 3500],
    ],
  }),
];

/* ------------------------------------------------------------------ *
 * Meetings
 * ------------------------------------------------------------------ */

export const meetings: Meeting[] = [
  {
    ...rec(7, 5),
    id: "mtg-1042-1",
    leadDomainId: "ldom-1042-furniture",
    professionalId: "pro-rakesh",
    type: "measurement",
    scheduledAt: daysAgo(5),
    location: "B-402, Eldeco Elegance, Gomti Nagar",
    status: "completed",
    notes: "Measured wardrobe wall at 7 ft 2 in. Ply stock checked, sufficient for carcass.",
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome:
      "Wall is 7 ft 2 in, not the 7 ft the customer estimated, and the ceiling is 10 ft 1 in — so the loft is a full 2 ft 6 in, taller than assumed. Her existing ply covers the carcass but not the loft shutters. Skirting runs behind the wardrobe line and will need cutting. All three vendors have been told to quote on 7 ft 2 in with the loft included.",
    outcomeRecordedAt: daysAgo(5),
    outcomeChangedScope: true,
  },
  {
    ...rec(7, 5),
    id: "mtg-1042-2",
    leadDomainId: "ldom-1042-furniture",
    professionalId: "pro-sunita",
    type: "measurement",
    scheduledAt: daysAgo(4),
    location: "B-402, Eldeco Elegance, Gomti Nagar",
    status: "completed",
    notes: null,
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome: null,
    outcomeRecordedAt: null,
    outcomeChangedScope: false,
  },
  {
    ...rec(7, 3),
    id: "mtg-1042-3",
    leadDomainId: "ldom-1042-furniture",
    professionalId: "pro-imran",
    type: "measurement",
    scheduledAt: daysAhead(1),
    location: "B-402, Eldeco Elegance, Gomti Nagar",
    status: "confirmed",
    notes: "Client available after 6 pm only.",
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome: null,
    outcomeRecordedAt: null,
    outcomeChangedScope: false,
  },
  {
    ...rec(7, 5),
    id: "mtg-1042-4",
    leadDomainId: "ldom-1042-painting",
    professionalId: "pro-santosh",
    type: "site_visit",
    scheduledAt: daysAgo(5),
    location: "B-402, Eldeco Elegance, Gomti Nagar",
    status: "completed",
    notes: "Two walls behind kitchen show old damp marks. Flagged to client.",
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome:
      "Damp on the two kitchen-side walls is coming from the neighbouring bathroom wall, not from outside — the patch is at skirting height and dry above 3 ft. Needs treatment before painting or it will surface again. Painted area measures 3,180 sq.ft including ceilings. All three painters asked to price the damp treatment as a separate line so the base figure stays comparable.",
    outcomeRecordedAt: daysAgo(4),
    outcomeChangedScope: true,
  },
  {
    ...rec(7, 4),
    id: "mtg-1042-5",
    leadDomainId: "ldom-1042-painting",
    professionalId: "pro-jyoti",
    type: "site_visit",
    scheduledAt: daysAgo(4),
    location: "B-402, Eldeco Elegance, Gomti Nagar",
    status: "completed",
    notes: null,
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome: null,
    outcomeRecordedAt: null,
    outcomeChangedScope: false,
  },
  {
    ...rec(3, 1),
    id: "mtg-1042-6",
    leadDomainId: "ldom-1042-painting",
    professionalId: "pro-devendra",
    type: "site_visit",
    scheduledAt: daysAhead(2),
    location: "B-402, Eldeco Elegance, Gomti Nagar",
    status: "scheduled",
    notes: null,
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome: null,
    outcomeRecordedAt: null,
    outcomeChangedScope: false,
  },
  {
    ...rec(92, 88),
    id: "mtg-1017-1",
    leadDomainId: "ldom-1017-interior",
    professionalId: "pro-aarohi",
    type: "consultation",
    scheduledAt: daysAgo(88),
    location: "House 27, Sushant Golf City",
    status: "completed",
    notes: "Discussed palette and kitchen layout. Client prefers matte finishes.",
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome:
      "Carpet area confirmed at 1,520 sq.ft. Kitchen plumbing is where the customer said, so no shifting. Master wardrobe wall is 9 ft 4 in. Client settled on matte throughout and ruled out gloss entirely. No change to scope.",
    outcomeRecordedAt: daysAgo(87),
    outcomeChangedScope: false,
  },
  {
    ...rec(50, 46),
    id: "mtg-1031-1",
    leadDomainId: "ldom-1031-fabrication",
    professionalId: "pro-vinod",
    type: "measurement",
    scheduledAt: daysAgo(46),
    location: "C-11, Indira Nagar Sector 14",
    status: "completed",
    notes: "46 running ft across three balconies including returns.",
    coordinatorId: "sales-kavita",
    addressReleasedAt: daysAgo(6),
    rescheduleRequestedAt: null,
    rescheduleNote: null,
    outcome:
      "46 running ft measured across three balconies including the returns, against the 40 ft the customer estimated. Parapet is 3 in out of level along the longest run, so the railing needs packing at the base — priced in. Glass infill confirmed over baluster.",
    outcomeRecordedAt: daysAgo(45),
    outcomeChangedScope: true,
  },
];

/* ------------------------------------------------------------------ *
 * Messages — the platform sits on one side of every thread
 *
 * The client talks to us; we talk to each vendor separately. Nobody messages
 * anybody directly, which is what lets one question be put to all three
 * vendors at once instead of only the one the client happened to write to.
 * ------------------------------------------------------------------ */

function msg(
  id: string,
  leadDomainId: string,
  channel: Message["channel"],
  senderRole: Message["senderRole"],
  senderId: string,
  professionalId: string | null,
  body: string,
  daysAgoValue: number,
  options: { attachmentUrl?: string; read?: boolean; relayedFrom?: string } = {},
): Message {
  return {
    ...rec(daysAgoValue, daysAgoValue),
    id,
    leadDomainId,
    channel,
    senderRole,
    senderId,
    professionalId,
    body,
    attachmentUrl: options.attachmentUrl ?? null,
    readAt: options.read === false ? null : daysAgo(daysAgoValue),
    relayedFromMessageId: options.relayedFrom ?? null,
  };
}

export const messages: Message[] = [
  /* ---- Furniture: vendor raises a scope question, we take it to the client ---- */
  msg(
    "msg-f1",
    "ldom-1042-furniture",
    "platform_vendor",
    "professional",
    "pro-rakesh",
    "pro-rakesh",
    "Visited today and measured the wall — 7 ft 2 in wide, 10 ft to the ceiling. The ply the customer has is enough for the carcass but not for the loft shutters. Should I include those in the quote?",
    5,
  ),
  msg(
    "msg-f2",
    "ldom-1042-furniture",
    "client_platform",
    "platform",
    "sales-kavita",
    null,
    "Hello Priya — the vendors who measured your wardrobe wall have flagged that your existing plywood covers the carcass but not the loft shutters. Do you want the loft included? We will put the same question to all three so their quotes stay comparable.",
    5,
    { relayedFrom: "msg-f1" },
  ),
  msg(
    "msg-f3",
    "ldom-1042-furniture",
    "client_platform",
    "client",
    "client-priya",
    null,
    "Yes, please include the loft shutters. And can the bed be done in the same laminate as the wardrobe?",
    5,
  ),
  msg(
    "msg-f4",
    "ldom-1042-furniture",
    "platform_vendor",
    "platform",
    "sales-kavita",
    "pro-rakesh",
    "Customer confirms: include loft shutters, and match the bed laminate to the wardrobe. Same instruction has gone to the other two vendors. Please quote on that basis.",
    5,
    { relayedFrom: "msg-f3" },
  ),
  msg(
    "msg-f5",
    "ldom-1042-furniture",
    "platform_vendor",
    "professional",
    "pro-rakesh",
    "pro-rakesh",
    "Understood. Quote uploaded — 18 days from advance, can start Monday.",
    4,
    { attachmentUrl: "/mock/quotes/q-1042-fur-rakesh.pdf" },
  ),
  msg(
    "msg-f6",
    "ldom-1042-furniture",
    "client_platform",
    "platform",
    "sales-kavita",
    null,
    "All three furniture quotes are in and ready to compare. They are priced labour-and-hardware only, since you are supplying the board.",
    4,
    { read: false },
  ),

  /* ---- Painting: a genuine technical finding, surfaced to the client by us ---- */
  msg(
    "msg-p1",
    "ldom-1042-painting",
    "platform_vendor",
    "professional",
    "pro-santosh",
    "pro-santosh",
    "The two walls behind the kitchen have old damp marks. Painting over them without treatment will show again in the next monsoon. I have quoted without treatment — please check with the customer.",
    5,
  ),
  msg(
    "msg-p2",
    "ldom-1042-painting",
    "client_platform",
    "platform",
    "sales-kavita",
    null,
    "One of our painters noticed old damp marks on the two walls behind your kitchen. Painting over them untreated will very likely show again after the monsoon. We have asked all three to price the damp treatment as a separate line so you can see exactly what it adds.",
    5,
    { relayedFrom: "msg-p1" },
  ),
  msg(
    "msg-p3",
    "ldom-1042-painting",
    "client_platform",
    "client",
    "client-priya",
    null,
    "Yes, please get that treatment priced. I would rather fix it now than repaint next year.",
    3,
  ),
  msg(
    "msg-p4",
    "ldom-1042-painting",
    "platform_vendor",
    "platform",
    "sales-kavita",
    "pro-santosh",
    "Customer wants the damp treatment included. Please send a revised quote with it as a separate line item.",
    3,
    { relayedFrom: "msg-p3" },
  ),
  msg(
    "msg-p5",
    "ldom-1042-painting",
    "client_platform",
    "platform",
    "sales-kavita",
    null,
    "Revised painting quotes including the damp treatment will be with you by tomorrow evening.",
    2,
    { read: false },
  ),
];

/* ------------------------------------------------------------------ *
 * Agreements — grouped by professional
 * ------------------------------------------------------------------ */

export const agreements: Agreement[] = [
  // ONE combined agreement: Aarohi covers both Interior and Furniture for Rohit.
  {
    ...rec(82, 12),
    id: "agr-1017-aarohi",
    reference: "AGR-1017-01",
    leadId: "lead-1017",
    clientId: "client-priya",
    professionalId: "pro-aarohi",
    totalValue: 1877040,
    paymentTerms:
      "40% advance on signing, 30% on delivery of materials to site, 20% on installation, 10% on handover.",
    status: "active",
    documentUrl: "/mock/agreements/agr-1017-aarohi.pdf",
    sentAt: daysAgo(83),
    signedAt: daysAgo(82),
    startDate: dateOnly(daysAgo(78)),
    cancelledReason: null,
  },
  // TWO separate agreements: different professionals for different domains.
  {
    ...rec(43, 6),
    id: "agr-1031-santosh",
    reference: "AGR-1031-01",
    leadId: "lead-1031",
    clientId: "client-priya",
    professionalId: "pro-santosh",
    totalValue: 183960,
    paymentTerms: "30% advance, 40% on completion of first coat, 30% on handover.",
    status: "active",
    documentUrl: "/mock/agreements/agr-1031-santosh.pdf",
    sentAt: daysAgo(44),
    signedAt: daysAgo(43),
    startDate: dateOnly(daysAgo(40)),
    cancelledReason: null,
  },
  {
    ...rec(42, 6),
    id: "agr-1031-vinod",
    reference: "AGR-1031-02",
    leadId: "lead-1031",
    clientId: "client-priya",
    professionalId: "pro-vinod",
    totalValue: 143310,
    paymentTerms: "50% advance for material procurement, 50% on installation.",
    // Sent but not yet signed — no project exists until the client signs.
    status: "sent",
    documentUrl: "/mock/agreements/agr-1031-vinod.pdf",
    sentAt: daysAgo(2),
    signedAt: null,
    startDate: null,
    cancelledReason: null,
  },
  {
    ...rec(130, 40),
    id: "agr-0994-santosh",
    reference: "AGR-0994-01",
    leadId: "lead-0994",
    clientId: "client-vikram",
    professionalId: "pro-santosh",
    totalValue: 91922,
    paymentTerms: "30% advance, balance on completion.",
    status: "completed",
    documentUrl: "/mock/agreements/agr-0994-santosh.pdf",
    sentAt: daysAgo(131),
    signedAt: daysAgo(130),
    startDate: dateOnly(daysAgo(128)),
    cancelledReason: null,
  },
];

export const agreementLeadDomains: AgreementLeadDomain[] = [
  // One agreement, two lead-domains — the combined case.
  { ...rec(82, 12), id: "ald-1", agreementId: "agr-1017-aarohi", leadDomainId: "ldom-1017-interior", quoteId: "q-1017-int-aarohi", value: 1748040 },
  { ...rec(82, 12), id: "ald-2", agreementId: "agr-1017-aarohi", leadDomainId: "ldom-1017-furniture", quoteId: "q-1017-fur-aarohi", value: 129000 },
  // Separate agreements, one lead-domain each.
  { ...rec(43, 6), id: "ald-3", agreementId: "agr-1031-santosh", leadDomainId: "ldom-1031-painting", quoteId: "q-1031-pnt-santosh", value: 183960 },
  { ...rec(42, 6), id: "ald-4", agreementId: "agr-1031-vinod", leadDomainId: "ldom-1031-fabrication", quoteId: "q-1031-fab-vinod", value: 143310 },
  { ...rec(130, 40), id: "ald-5", agreementId: "agr-0994-santosh", leadDomainId: "ldom-0994-painting", quoteId: "q-0994-pnt-santosh", value: 91922 },
];

/* ------------------------------------------------------------------ *
 * Projects — one per lead-domain, even under a combined agreement
 * ------------------------------------------------------------------ */

export const projects: Project[] = [
  {
    ...rec(78, 3),
    id: "prj-1017-int",
    reference: "PRJ-1017-INT",
    leadDomainId: "ldom-1017-interior",
    agreementId: "agr-1017-aarohi",
    clientId: "client-priya",
    professionalId: "pro-aarohi",
    quoteId: "q-1017-int-aarohi",
    value: 1748040,
    commissionPercent: 10,
    commissionAmount: 174804,
    startDate: dateOnly(daysAgo(78)),
    estimatedEndDate: dateOnly(daysAhead(6)),
    actualEndDate: null,
    completionPercent: 82,
    status: "ongoing",
    milestones: [
      {
        id: "ms-1",
        title: "Design sign-off",
        description: null,
        completedAt: daysAgo(76),
        proof: phSet("proof", "ms-1", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(76),
        verification: "approved",
        verifiedAt: daysAgo(76),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-2",
        title: "Carcass delivered to site",
        description: null,
        completedAt: daysAgo(52),
        proof: phSet("proof", "ms-2", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(52),
        verification: "approved",
        verifiedAt: daysAgo(52),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-3",
        title: "Kitchen installed",
        description: null,
        completedAt: daysAgo(30),
        proof: phSet("proof", "ms-3", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(30),
        verification: "approved",
        verifiedAt: daysAgo(30),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-4",
        title: "Wardrobes installed",
        description: null,
        completedAt: daysAgo(14),
        proof: phSet("proof", "ms-4", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(14),
        verification: "approved",
        verifiedAt: daysAgo(14),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-5",
        title: "False ceiling and lighting",
        description: "Gypsum ceiling in living and dining, cove and profile lighting wired and tested.",
        completedAt: null,
        proof: phSet("proof", "ms-5", 3),
        proofNote:
          "Ceiling boarded and taped in both rooms, cove lighting wired and tested. Profile lights in the dining cove are fitted but the dimmer module is still on order — expected Thursday, then this stage is finished.",
        submittedAt: daysAgo(2),
        verification: "submitted",
        verifiedAt: null,
        verifiedByUserId: null,
        verifierNote: null,
      },
      {
        id: "ms-6",
        title: "Handover",
        description: null,
        completedAt: null,
        proof: [],
        proofNote: null,
        submittedAt: null,
        verification: "not_started",
        verifiedAt: null,
        verifiedByUserId: null,
        verifierNote: null,
      },
    ],
  },
  {
    ...rec(78, 3),
    id: "prj-1017-fur",
    reference: "PRJ-1017-FUR",
    leadDomainId: "ldom-1017-furniture",
    agreementId: "agr-1017-aarohi",
    clientId: "client-priya",
    professionalId: "pro-aarohi",
    quoteId: "q-1017-fur-aarohi",
    value: 129000,
    commissionPercent: 8,
    commissionAmount: 10320,
    startDate: dateOnly(daysAgo(52)),
    estimatedEndDate: dateOnly(daysAgo(8)),
    actualEndDate: dateOnly(daysAgo(9)),
    completionPercent: 100,
    status: "completed",
    milestones: [
      {
        id: "ms-7",
        title: "Wood selection approved",
        description: null,
        completedAt: daysAgo(50),
        proof: phSet("proof", "ms-7", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(50),
        verification: "approved",
        verifiedAt: daysAgo(50),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-8",
        title: "Table and chairs delivered",
        description: null,
        completedAt: daysAgo(12),
        proof: phSet("proof", "ms-8", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(12),
        verification: "approved",
        verifiedAt: daysAgo(12),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-9",
        title: "Crockery unit installed",
        description: null,
        completedAt: daysAgo(9),
        proof: phSet("proof", "ms-9", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(9),
        verification: "approved",
        verifiedAt: daysAgo(9),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
    ],
  },
  {
    ...rec(40, 4),
    id: "prj-1031-pnt",
    reference: "PRJ-1031-PNT",
    leadDomainId: "ldom-1031-painting",
    agreementId: "agr-1031-santosh",
    clientId: "client-priya",
    professionalId: "pro-santosh",
    quoteId: "q-1031-pnt-santosh",
    value: 183960,
    commissionPercent: 8,
    commissionAmount: 14717,
    startDate: dateOnly(daysAgo(40)),
    estimatedEndDate: dateOnly(daysAgo(28)),
    actualEndDate: dateOnly(daysAgo(26)),
    completionPercent: 100,
    status: "completed",
    milestones: [
      {
        id: "ms-10",
        title: "Scaffolding erected",
        description: null,
        completedAt: daysAgo(40),
        proof: phSet("proof", "ms-10", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(40),
        verification: "approved",
        verifiedAt: daysAgo(40),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-11",
        title: "Surface prep complete",
        description: null,
        completedAt: daysAgo(36),
        proof: phSet("proof", "ms-11", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(36),
        verification: "approved",
        verifiedAt: daysAgo(36),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-12",
        title: "Final coat",
        description: null,
        completedAt: daysAgo(27),
        proof: phSet("proof", "ms-12", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(27),
        verification: "approved",
        verifiedAt: daysAgo(27),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
    ],
  },
  {
    ...rec(128, 40),
    id: "prj-0994-pnt",
    reference: "PRJ-0994-PNT",
    leadDomainId: "ldom-0994-painting",
    agreementId: "agr-0994-santosh",
    clientId: "client-vikram",
    professionalId: "pro-santosh",
    quoteId: "q-0994-pnt-santosh",
    value: 91922,
    commissionPercent: 8,
    commissionAmount: 7354,
    startDate: dateOnly(daysAgo(128)),
    estimatedEndDate: dateOnly(daysAgo(123)),
    actualEndDate: dateOnly(daysAgo(124)),
    completionPercent: 100,
    status: "completed",
    milestones: [
      {
        id: "ms-16",
        title: "Prep and masking",
        description: null,
        completedAt: daysAgo(128),
        proof: phSet("proof", "ms-16", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(128),
        verification: "approved",
        verifiedAt: daysAgo(128),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
      {
        id: "ms-17",
        title: "Two coats complete",
        description: null,
        completedAt: daysAgo(124),
        proof: phSet("proof", "ms-17", 2),
        proofNote: "Stage completed and photographed on site.",
        submittedAt: daysAgo(124),
        verification: "approved",
        verifiedAt: daysAgo(124),
        verifiedByUserId: "user-admin",
        verifierNote: null,
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Commission invoices — one per agreement
 * ------------------------------------------------------------------ */

export const commissionInvoices: CommissionInvoice[] = [
  {
    ...rec(82, 3),
    id: "inv-1017-aarohi",
    reference: "INV-2026-0417",
    professionalId: "pro-aarohi",
    agreementId: "agr-1017-aarohi",
    // One combined agreement -> one invoice covering both projects under it.
    amount: 185124,
    status: "pending",
    dueDate: dateOnly(daysAhead(9)),
    paidDate: null,
    adjustmentNote: null,
  },
  {
    ...rec(43, 5),
    id: "inv-1031-santosh",
    reference: "INV-2026-0388",
    professionalId: "pro-santosh",
    agreementId: "agr-1031-santosh",
    amount: 14717,
    status: "paid",
    dueDate: dateOnly(daysAgo(20)),
    paidDate: dateOnly(daysAgo(23)),
    adjustmentNote: null,
  },
  {
    ...rec(130, 40),
    id: "inv-0994-santosh",
    reference: "INV-2026-0201",
    professionalId: "pro-santosh",
    agreementId: "agr-0994-santosh",
    amount: 7354,
    status: "paid",
    dueDate: dateOnly(daysAgo(115)),
    paidDate: dateOnly(daysAgo(118)),
    adjustmentNote: null,
  },
];

/* ------------------------------------------------------------------ *
 * Reviews — per project, therefore per domain
 * ------------------------------------------------------------------ */

export const reviews: Review[] = [
  {
    ...rec(24, 24),
    id: "rev-2",
    projectId: "prj-1031-pnt",
    clientId: "client-priya",
    professionalId: "pro-santosh",
    domainId: "dom-painting",
    rating: 5,
    comment:
      "Scaffolding went up on day one and the crew was on site every day until it was done. Two days early, and they cleaned the compound before leaving.",
    qualityRating: 5,
    timelinessRating: 5,
    professionalismRating: 5,
  },
  {
    ...rec(122, 122),
    id: "rev-3",
    projectId: "prj-0994-pnt",
    clientId: "client-vikram",
    professionalId: "pro-santosh",
    domainId: "dom-painting",
    rating: 5,
    comment: "Moved in on schedule because they finished on schedule. No complaints at all.",
    qualityRating: 5,
    timelinessRating: 5,
    professionalismRating: 5,
  },
];

/* ------------------------------------------------------------------ *
 * Sales activity, notifications, tickets, referrals
 * ------------------------------------------------------------------ */

export const leadSalesActivities: LeadSalesActivity[] = [
  {
    ...rec(8, 8),
    id: "lsa-1",
    leadId: "lead-1042",
    salesAgentId: "sales-kavita",
    callStatus: "connected",
    remarks:
      "Master bedroom wardrobe is 7 ft x 10 ft, wants loft included. Ply already purchased (Century BWR, 12 sheets) so furniture vendors to quote labour + hardware only. Painting is full 2BHK, approx 1050 sq.ft carpet, two walls behind kitchen have old damp marks — flagged for vendors to inspect. Society allows work 9 am to 6 pm on weekdays only.",
    recordingUrl: "/mock/calls/lsa-1.mp3",
    followUpDate: dateOnly(daysAgo(6)),
  },
  {
    ...rec(6, 6),
    id: "lsa-2",
    leadId: "lead-1042",
    salesAgentId: "sales-kavita",
    callStatus: "connected",
    remarks: "Confirmed all three furniture vendors and three painters for site visits. Client prefers evening slots after 6 pm.",
    recordingUrl: null,
    followUpDate: dateOnly(daysAhead(1)),
  },
  {
    ...rec(2, 2),
    id: "lsa-3",
    leadId: "lead-1055",
    salesAgentId: "sales-kavita",
    callStatus: "connected",
    remarks:
      "Came in through the Home Security Package page. Actually 9 windows not 8, two of them are 6 ft wide bay windows so grill area is higher than the package assumes. Wants powder coating, not enamel. Ready to start immediately.",
    recordingUrl: "/mock/calls/lsa-3.mp3",
    followUpDate: dateOnly(daysAhead(1)),
  },
  {
    ...rec(1, 1),
    id: "lsa-4",
    leadId: "lead-1061",
    salesAgentId: "sales-amit",
    callStatus: "not_reachable",
    remarks: "Two attempts, no answer. Will try evening.",
    recordingUrl: null,
    followUpDate: dateOnly(daysAhead(1)),
  },
  {
    ...rec(1, 1),
    id: "lsa-5",
    leadId: "lead-1061",
    salesAgentId: "sales-amit",
    callStatus: "connected",
    remarks:
      "6-seater dining table, 72 x 36 in, solid sheesham preferred over veneer — he was clear about that. Wants a matte finish, not gloss. Chairs to be quoted separately as he may reuse his existing ones. Flat is on the 3rd floor with a lift, but the lift is small: table top must come up the stairs or be assembled on site. No rush, comparing prices for now.",
    recordingUrl: "/mock/calls/lsa-5.mp3",
    followUpDate: dateOnly(daysAhead(3)),
  },
  {
    ...rec(90, 90),
    id: "lsa-6",
    leadId: "lead-1017",
    salesAgentId: "sales-amit",
    callStatus: "connected",
    remarks:
      "3BHK, 1520 sq.ft carpet, possession done and site is empty. Kitchen is L-shaped, 10.5 x 8 ft, existing plumbing to stay. Three wardrobes: master 9 ft, other two 7 ft each, all floor-to-ceiling with loft. Wants matte finishes throughout, no gloss anywhere. False ceiling in living and dining only, bedrooms plain with cove. Also wants the dining table and crockery unit from the same team so the wood matches — quoted as furniture, separately from the interior BOQ.",
    recordingUrl: "/mock/calls/lsa-6.mp3",
    followUpDate: null,
  },
];

export const notifications: Notification[] = [
  {
    ...rec(4, 4),
    id: "ntf-1",
    userId: "user-client-priya",
    type: "quote_uploaded",
    title: "New quote from Colour Craft Painting Co.",
    body: "Santosh has uploaded a quote for your painting requirement.",
    entityType: "quote",
    entityId: "q-1042-pnt-santosh",
    isRead: false,
  },
  {
    ...rec(4, 4),
    id: "ntf-2",
    userId: "user-client-priya",
    type: "quote_uploaded",
    title: "New quote from Yadav Furniture Works",
    body: "Rakesh has uploaded a quote for your furniture requirement.",
    entityType: "quote",
    entityId: "q-1042-fur-rakesh",
    isRead: false,
  },
  {
    ...rec(5, 5),
    id: "ntf-3",
    userId: "user-client-priya",
    type: "meeting_confirmed",
    title: "Site visit confirmed",
    body: "Qureshi Design Build will visit tomorrow at 6:30 pm for measurement.",
    entityType: "meeting",
    entityId: "mtg-1042-3",
    isRead: true,
  },
  {
    ...rec(7, 7),
    id: "ntf-4",
    userId: "user-client-priya",
    type: "professional_assigned",
    title: "3 professionals assigned for Furniture",
    body: "We have assigned three verified furniture vendors to your requirement.",
    entityType: "lead_domain",
    entityId: "ldom-1042-furniture",
    isRead: true,
  },
  {
    ...rec(3, 3),
    id: "ntf-5",
    userId: "user-pro-rakesh",
    type: "new_lead",
    title: "New furniture lead in Gomti Nagar",
    body: "Wardrobe and bed, customer supplying material. Urgency: immediate.",
    entityType: "lead_domain",
    entityId: "ldom-1042-furniture",
    isRead: true,
  },
  {
    ...rec(3, 3),
    id: "ntf-6",
    userId: "user-pro-aarohi",
    type: "commission_due",
    title: "Commission invoice INV-2026-0417 is due in 9 days",
    body: "₹1,85,124 across both projects under agreement AGR-1017-01.",
    entityType: "invoice",
    entityId: "inv-1017-aarohi",
    isRead: false,
  },
];

export const supportTickets: SupportTicket[] = [
  {
    ...rec(4, 1),
    id: "tkt-0",
    reference: "TKT-2026-0121",
    raisedByUserId: "user-client-priya",
    leadId: "lead-1042",
    projectId: null,
    category: "query",
    subject: "Can the painting quotes include the damp treatment?",
    body: "Two of the painters mentioned damp behind the kitchen but only one priced the treatment. Can all three quote it the same way so I can compare properly?",
    priority: "medium",
    status: "resolved",
    assignedToUserId: "user-admin",
    replies: [
      {
        id: "trep-0a",
        authorRole: "platform",
        authorName: "Kavita (Aangan support)",
        body: "Good catch — we have asked all three to price the damp treatment as a separate line item so the base painting figure stays comparable between them. Revised quotes are due by tomorrow evening.",
        createdAt: daysAgo(3),
      },
      {
        id: "trep-0b",
        authorRole: "client",
        authorName: "Priya Sharma",
        body: "Perfect, thank you. That is exactly what I needed.",
        createdAt: daysAgo(3),
      },
    ],
  },
  {
    ...rec(12, 2),
    id: "tkt-1",
    reference: "TKT-2026-0112",
    raisedByUserId: "user-client-priya",
    leadId: "lead-1031",
    projectId: null,
    category: "escalation",
    subject: "Railing installation delayed by a week",
    body: "Fabrication was completed on time but installation has not started. No update from the vendor for four days.",
    priority: "high",
    status: "in_progress",
    assignedToUserId: "user-admin",
    replies: [
      {
        id: "trep-1",
        authorRole: "platform",
        authorName: "Neha (Aangan support)",
        body: "We have spoken to the fabricator. Installation is scheduled for this Saturday and we will confirm the slot with you by Thursday.",
        createdAt: daysAgo(2),
      },
    ],
  },
  {
    ...rec(5, 1),
    id: "tkt-2",
    reference: "TKT-2026-0119",
    raisedByUserId: "user-pro-arif",
    leadId: null,
    projectId: null,
    category: "query",
    subject: "How do I add Painting to my profile?",
    body: "I also take painting work. How can I start receiving painting leads?",
    priority: "low",
    status: "open",
    assignedToUserId: null,
    replies: [],
  },
];

export const referrals: Referral[] = [
  {
    ...rec(20, 20),
    id: "ref-1",
    referrerUserId: "user-client-priya",
    referredUserId: "user-client-sameer",
    rewardStatus: "pending",
    rewardAmount: 1000,
  },
];
