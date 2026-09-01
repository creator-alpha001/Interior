import type { ProductCategory } from "@repo/types";
import { rec } from "../helpers";

interface CatSeed {
  id: string;
  domainId: string;
  name: string;
  description: string;
}

const seeds: CatSeed[] = [
  // Interior Design
  { id: "cat-full-home", domainId: "dom-interior", name: "Full Home Interiors", description: "Turnkey interiors for 1BHK to 4BHK homes and villas." },
  { id: "cat-modular-kitchen", domainId: "dom-interior", name: "Modular Kitchen", description: "Layout, shutters, counters, hardware and appliances integration." },
  { id: "cat-wardrobe-design", domainId: "dom-interior", name: "Wardrobes & Storage", description: "Designed storage — walk-ins, sliding wardrobes, loft and utility." },
  { id: "cat-ceiling-lighting", domainId: "dom-interior", name: "False Ceiling & Lighting", description: "POP and gypsum ceilings with layered lighting design." },
  { id: "cat-living-dining", domainId: "dom-interior", name: "Living & Dining", description: "TV walls, partitions, crockery units and accent panelling." },
  { id: "cat-kids-room", domainId: "dom-interior", name: "Kids & Study Rooms", description: "Bunk beds, study desks and storage designed to grow with the child." },

  // Furniture
  { id: "cat-wardrobes", domainId: "dom-furniture", name: "Wardrobes", description: "Hinged, sliding and walk-in wardrobes made to your wall size." },
  { id: "cat-beds", domainId: "dom-furniture", name: "Beds", description: "Single to king beds, with hydraulic or drawer storage." },
  { id: "cat-seating", domainId: "dom-furniture", name: "Sofas & Seating", description: "Sofas, sofa-cum-beds, recliners, benches and window seats." },
  { id: "cat-dining", domainId: "dom-furniture", name: "Dining", description: "Dining tables, chairs, benches and crockery units." },
  { id: "cat-tv-units", domainId: "dom-furniture", name: "TV Units", description: "Wall-mounted and floor-standing entertainment units." },
  { id: "cat-study", domainId: "dom-furniture", name: "Study & Office", description: "Study tables, work-from-home desks, bookshelves and chairs." },
  { id: "cat-storage", domainId: "dom-furniture", name: "Storage & Shoe Racks", description: "Shoe cabinets, chest of drawers, sideboards and utility units." },
  { id: "cat-kitchen-furniture", domainId: "dom-furniture", name: "Kitchen Units", description: "Base and wall units, tall units and breakfast counters." },

  // Fabrication
  { id: "cat-gates", domainId: "dom-fabrication", name: "Main Gates", description: "Sliding, swing and folding gates in MS, SS and aluminium." },
  { id: "cat-grills", domainId: "dom-fabrication", name: "Window Grills", description: "Safety grills in MS square pipe, flat bar and designer profiles." },
  { id: "cat-railings", domainId: "dom-fabrication", name: "Railings", description: "Staircase, balcony and terrace railings in steel and glass." },
  { id: "cat-sheds", domainId: "dom-fabrication", name: "Sheds & Canopies", description: "Parking sheds, terrace roofing and entrance canopies." },
  { id: "cat-security-doors", domainId: "dom-fabrication", name: "Security Doors", description: "Safety doors, mosquito-mesh doors and collapsible gates." },
  { id: "cat-fencing", domainId: "dom-fabrication", name: "Fencing & Structures", description: "Compound fencing, mezzanine floors and structural steel work." },

  // Painting
  { id: "cat-interior-painting", domainId: "dom-painting", name: "Interior Painting", description: "Repainting and fresh painting for walls and ceilings." },
  { id: "cat-exterior-painting", domainId: "dom-painting", name: "Exterior Painting", description: "Weatherproof exterior coatings for homes and buildings." },
  { id: "cat-texture", domainId: "dom-painting", name: "Texture & Feature Walls", description: "Stencil, metallic, travertine and wallpaper-effect finishes." },
  { id: "cat-waterproofing", domainId: "dom-painting", name: "Waterproofing", description: "Terrace, bathroom and external wall waterproofing systems." },
  { id: "cat-wood-metal", domainId: "dom-painting", name: "Wood & Metal Painting", description: "PU and melamine polishing, enamel painting for grills and gates." },
];

export const productCategories: ProductCategory[] = seeds.map((s, i) => ({
  ...rec(360, 40),
  id: s.id,
  domainId: s.domainId,
  parentId: null,
  name: s.name,
  slug: s.id.replace("cat-", ""),
  description: s.description,
  imageUrl: null,
  sortOrder: i + 1,
  isActive: true,
}));
