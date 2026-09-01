import type { Banner, BlogCategory, BlogPost, BlogTag, Testimonial } from "@repo/types";
import { daysAgo, rec } from "./helpers";

export const blogCategories: BlogCategory[] = [
  { ...rec(300, 60), id: "bcat-guides", name: "Buying Guides", slug: "buying-guides", description: "How to choose materials, finishes and vendors without being talked into things you do not need." },
  { ...rec(300, 60), id: "bcat-costs", name: "Costs & Budgeting", slug: "costs-and-budgeting", description: "What things actually cost in 2026, and where budgets tend to overrun." },
  { ...rec(300, 60), id: "bcat-ideas", name: "Design Ideas", slug: "design-ideas", description: "Ideas that work in real Indian homes, at real sizes." },
  { ...rec(300, 60), id: "bcat-maintenance", name: "Care & Maintenance", slug: "care-and-maintenance", description: "Keeping what you have built in good condition." },
];

export const blogTags: BlogTag[] = [
  { ...rec(300, 60), id: "btag-kitchen", name: "Kitchen", slug: "kitchen" },
  { ...rec(300, 60), id: "btag-budget", name: "Budget", slug: "budget" },
  { ...rec(300, 60), id: "btag-painting", name: "Painting", slug: "painting" },
  { ...rec(300, 60), id: "btag-monsoon", name: "Monsoon", slug: "monsoon" },
  { ...rec(300, 60), id: "btag-wardrobe", name: "Wardrobe", slug: "wardrobe" },
  { ...rec(300, 60), id: "btag-steel", name: "Steel & Fabrication", slug: "steel" },
  { ...rec(300, 60), id: "btag-materials", name: "Materials", slug: "materials" },
];

interface PostSeed {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  domainId: string | null;
  author: string;
  authorRole: string;
  publishedDaysAgo: number;
  minutes: number;
  featured?: boolean;
  body: string;
}

const seeds: PostSeed[] = [
  {
    slug: "what-a-modular-kitchen-costs-in-2026",
    title: "What a Modular Kitchen Actually Costs in 2026",
    excerpt:
      "Quotes for the same kitchen can differ by two lakh rupees. Here is what drives the number, line by line, so you can read a quotation instead of guessing at it.",
    category: "bcat-costs",
    tags: ["btag-kitchen", "btag-budget", "btag-materials"],
    domainId: "dom-interior",
    author: "Aarohi Verma",
    authorRole: "Interior Designer, Lucknow",
    publishedDaysAgo: 6,
    minutes: 8,
    featured: true,
    body: `Ask three vendors to quote for the same kitchen and you will get three numbers that look nothing alike. The difference is almost never the cabinets themselves. It is in four line items that customers rarely compare directly.

## 1. The carcass material

The box behind the shutter is what decides whether your kitchen survives ten years of Indian humidity.

- **Commercial ply** — cheapest, and the reason kitchens swell at the bottom after two monsoons. Avoid it below the counter.
- **BWR ply** — boiling water resistant, adequate for wall units and dry areas.
- **BWP marine ply** — the correct specification for base units. Costs roughly 20-25% more than BWR and is the single best place to spend extra money.
- **HDHMR** — dense, uniform, takes screws well, and handles moisture better than MDF. A reasonable alternative where budget is tight.

If a quote does not name the grade, assume the cheapest one.

## 2. The shutter finish

This is where the visual money goes, and where the price range is widest.

| Finish | Indicative rate | Notes |
| --- | --- | --- |
| Laminate | Base | Durable, huge range, shows joints at edges |
| Membrane | +10-15% | Seamless look, can peel near heat |
| Acrylic | +25-30% | High gloss, shows fingerprints |
| PU paint | +30-35% | Best matte finish, needs skilled application |

## 3. Hardware

Hinges and channels are a third of the feel of a kitchen and a small fraction of the cost. Soft-close hardware from Hettich, Blum or Ebco is worth insisting on. Where a quote is suspiciously cheap, hardware is usually the first thing that was substituted.

## 4. What is excluded

Read the exclusions before the inclusions. The four items most often left out of a headline price:

1. Counter (quartz or granite)
2. Sink and tap
3. Chimney, hob and appliances
4. Dado tiling and any plumbing shifting

A quote of ₹2.4 lakh that excludes all four is not cheaper than one of ₹3.1 lakh that includes them.

## A realistic range

For a standard L-shaped kitchen of about 90-100 sq.ft of shutter area in 2026:

- **Functional** — BWR carcass, laminate shutters, basic accessories: ₹1.6-2.1 lakh
- **Mid** — marine ply base, membrane shutters, tandem baskets, quartz counter: ₹2.4-3.2 lakh
- **Premium** — marine ply, acrylic or PU shutters, full accessory pack, appliances: ₹4-6 lakh

Anything meaningfully below the functional band is being achieved by substituting the carcass, the hardware, or both.`,
  },
  {
    slug: "before-the-monsoon-checklist",
    title: "The Pre-Monsoon Checklist Every Homeowner Skips",
    excerpt:
      "Six things worth doing in the four weeks before the rain arrives — and why doing them together costs far less than doing them one at a time.",
    category: "bcat-maintenance",
    tags: ["btag-monsoon", "btag-painting"],
    domainId: "dom-painting",
    author: "Santosh Kumar",
    authorRole: "Painting Contractor, Lucknow",
    publishedDaysAgo: 14,
    minutes: 6,
    featured: true,
    body: `Almost every damp wall we are called to treat in August could have been prevented in May for a fraction of the cost. Here is what is worth doing before the rain.

## 1. Clear the terrace drains

Free, takes an hour, and prevents more damage than anything else on this list. Standing water on a terrace will find its way through any hairline crack in the slab.

## 2. Check the terrace surface for cracks

Look particularly at the junction where the parapet wall meets the floor. That corner is where waterproofing fails first, which is why a proper job includes a fillet at that joint rather than just a coat over the top.

## 3. Look at the outside of the walls that were damp last year

Damp shows on the inside, but it enters from the outside, and rarely at the same height. Trace upward and outward from the internal patch.

## 4. Test the downtake pipes

Pour a bucket of water into each and watch where it comes out. A cracked or disconnected downtake behind a wall is a common cause of a persistent internal damp patch that repainting never fixes.

## 5. Repaint metal before rust spreads

A grill with surface rust can be wire-brushed and repainted. A grill that has been rusting for three monsoons has lost section and needs replacing. The window for the cheap fix is narrow.

## 6. Combine the jobs

This is the one that saves real money. Exterior painting and terrace waterproofing both need scaffolding, site setup and a crew on site. Done together, you pay for that once. Done six months apart, you pay for it twice — typically ₹18,000-25,000 of avoidable cost on a standard independent house.

If you only do one thing on this list, clear the drains. If you do two, add the terrace inspection.`,
  },
  {
    slug: "sliding-vs-hinged-wardrobe",
    title: "Sliding or Hinged? Choosing the Right Wardrobe for Your Room",
    excerpt:
      "Sliding wardrobes look neater and cost more. Hinged wardrobes give you more usable space. Which one is right depends on one measurement.",
    category: "bcat-guides",
    tags: ["btag-wardrobe", "btag-materials"],
    domainId: "dom-furniture",
    author: "Rakesh Yadav",
    authorRole: "Furniture Maker, Lucknow",
    publishedDaysAgo: 22,
    minutes: 5,
    body: `The decision comes down to how much clear floor you have in front of the wardrobe wall.

## Measure this first

Stand at the wardrobe wall and measure to the nearest obstruction — the bed, the dresser, the door swing. If you have **less than 600 mm**, a hinged shutter cannot open fully and you should be looking at sliding. If you have more, both are on the table.

## What sliding costs you

A sliding wardrobe loses roughly 80-100 mm of internal depth to the track, and you can only ever access half the wardrobe at once. On a 6 ft wardrobe that is a real constraint when you are trying to find something at the far end behind an open shutter.

It also costs 15-20% more, almost entirely in the channel hardware. Do not economise there: a cheap sliding channel is the single most common wardrobe complaint we hear, usually about a year and a half in.

## What hinged costs you

Swing clearance, and a slightly busier look when shutters are open. That is largely it. You get full depth, full access, and cheaper hardware that is easier to replace.

## The practical rule

- Bedroom under about 120 sq.ft, or wardrobe facing the bed at close range: **sliding**
- Room with clear circulation, or a wardrobe you open in a hurry every morning: **hinged**
- Wardrobe longer than 8 ft: **sliding**, because three or four hinged shutters in a row start to feel like a corridor of doors

## One thing both should have

A loft. Ceiling height in most Indian flats leaves 500-700 mm of unused space above a standard 7 ft wardrobe. Closing that with loft storage costs comparatively little at the time of building and is expensive to add later.`,
  },
  {
    slug: "ms-vs-ss-vs-aluminium",
    title: "MS, Stainless or Aluminium? Picking the Right Metal for Gates and Railings",
    excerpt:
      "Three metals, three very different price points and lifespans. What each is genuinely good for, and where paying more is wasted.",
    category: "bcat-guides",
    tags: ["btag-steel", "btag-materials"],
    domainId: "dom-fabrication",
    author: "Devendra Singh",
    authorRole: "Fabricator, Lucknow",
    publishedDaysAgo: 31,
    minutes: 7,
    body: `## Mild steel (MS)

The default, and for most jobs the right answer. Strong, weldable, easy to repair locally, and cheap. Its one weakness is rust, which is entirely a question of finish.

- **Enamel over red-oxide primer** — cheapest, needs repainting every 2-3 years
- **Powder coating** — done in a workshop with proper pre-treatment, lasts 7-10 years and is worth the 15-20% premium every time

Use MS for: main gates, window grills, balcony railings, sheds, structural work.

## Stainless steel (SS)

Two grades matter. **304** is the real thing and does not rust in normal Indian conditions. **202** is cheaper, magnetic, and will show rust spots within a few years — it is frequently sold as "stainless" without qualification. Ask which grade, and check with a magnet.

SS costs roughly two and a half times MS for equivalent work. It earns that in exactly three situations: coastal or high-humidity locations, staircase railings you touch every day, and anywhere you genuinely do not want to repaint anything ever again.

Use SS for: staircase and balcony railings, canopies, entrance features.

## Aluminium

Light, corrosion-proof, and cannot be welded by an ordinary site fabricator — it needs proper equipment. Not structurally strong enough for gates or security work.

Use aluminium for: mosquito mesh frames, window sections, ACP cladding frameworks, louvres.

## Where money is commonly wasted

Specifying SS for a compound gate that is never touched and is 40 running feet long. Powder-coated MS at a third of the cost will look the same from the road and last a decade. Spend the difference on the staircase railing instead, which is the piece your hand is on every day.`,
  },
  {
    slug: "how-to-read-a-painting-quote",
    title: "How to Read a Painting Quotation",
    excerpt:
      "Two painting quotes for the same house, ₹40,000 apart. The difference is almost always in the preparation, which is the part nobody itemises.",
    category: "bcat-costs",
    tags: ["btag-painting", "btag-budget"],
    domainId: "dom-painting",
    author: "Platform Editorial",
    authorRole: "Editorial",
    publishedDaysAgo: 40,
    minutes: 6,
    body: `Painting is the trade where quotations are hardest to compare, because the expensive part is invisible once the job is done.

## Area: painted, not carpet

A 1000 sq.ft carpet-area flat has roughly 3000-3500 sq.ft of paintable wall and ceiling. A quote priced "per sq.ft" must state which area it means. If it does not, ask — a three-fold difference hides there.

## Preparation is the real variable

The finish coat is the same in every quote. What differs:

- **Minor repair** — filling visible cracks, light sanding. Fine for a wall that is in good condition.
- **One coat putty** — for walls with patchy absorption.
- **Two coats putty with sanding** — the standard for new plaster or a wall that has never been putty-finished.
- **Scrape and redo** — where old paint is flaking. Labour-heavy and unavoidable when needed.

A quote that is 30% cheaper is usually offering less of this, not less profit.

## Number of coats, honestly

"Two coats" should mean two full coats over primer. A dark colour going over a light one, or a light one over dark, often needs three. If the vendor knows that and has not priced it, one of you is going to be unhappy at the end.

## Brand and product line, not just brand

"Asian Paints" is not a specification. Tractor Emulsion and Royale Aspira are both Asian Paints and differ by more than double in price. The product name should be written on the quote.

## What should be included and often is not

- Covering furniture and flooring
- Daily site cleaning
- Minor hardware removal and refitting
- Touch-ups after other trades finish

## A fair comparison

Ask every vendor to quote the same preparation specification and the same product line. Nine times out of ten the gap between quotes closes to within 10%, and you are then choosing on crew quality and timeline rather than on a number that was never comparing the same job.`,
  },
  {
    slug: "small-flat-storage-ideas",
    title: "Eleven Storage Ideas That Actually Work in a Small Flat",
    excerpt:
      "Storage ideas that survive contact with a real 2BHK — tested on flats between 600 and 950 sq.ft, where every extra unit has to earn its floor area.",
    category: "bcat-ideas",
    tags: ["btag-wardrobe", "btag-budget"],
    domainId: "dom-interior",
    author: "Nidhi Srivastava",
    authorRole: "Interior Designer, Lucknow",
    publishedDaysAgo: 52,
    minutes: 7,
    body: `Every one of these has been built in a flat under 950 sq.ft and is still in use.

1. **Loft above every wardrobe.** The 500-700 mm between a 7 ft wardrobe and the ceiling is the cheapest storage in the house. Suitcases, quilts, festival items.
2. **Bed with hydraulic storage rather than drawers.** Drawers need floor clearance to open and hold less. A hydraulic box holds an entire season of bedding.
3. **Full-height entrance unit.** A 300 mm deep unit from floor to ceiling by the door takes shoes, bags, umbrellas and keys, and defines the entry in a flat that has no foyer.
4. **Seat with storage under the window.** Adds seating without adding a chair, and swallows toys or linen.
5. **Tall unit at the end of the kitchen run.** More usable than a corner unit and considerably cheaper than a pull-out corner mechanism.
6. **Above-door shelves.** The 400 mm above an internal door frame is dead space in almost every flat.
7. **Toe-kick drawers.** The 100 mm plinth under a kitchen base unit can be a shallow drawer for trays and flat items.
8. **Study desk with a wardrobe over it.** In a child's room, stacking the two vertically frees the floor for actually playing.
9. **Mirror that opens.** A full-length mirror on a shallow hinged cabinet holds jewellery and daily items in the space of nothing.
10. **Utility-balcony wall units.** Closed units on the balcony wall, in a moisture-tolerant material, take cleaning supplies out of the kitchen.
11. **Bathroom mirror cabinet instead of a plain mirror.** Costs a few thousand more and removes the countertop clutter permanently.

The common thread: every one of these uses vertical space or dead space, not floor area. In a small flat, floor area is the thing you cannot buy more of.`,
  },
  {
    slug: "vendor-verification-explained",
    title: "How We Verify Every Professional on the Platform",
    excerpt:
      "What the verified badge means, what we check before a vendor can receive a lead, and what we do when a project goes wrong.",
    category: "bcat-guides",
    tags: ["btag-materials"],
    domainId: null,
    author: "Platform Editorial",
    authorRole: "Editorial",
    publishedDaysAgo: 68,
    minutes: 4,
    body: `A verified badge on this platform is not automatic and is not permanent.

## Before a vendor receives their first lead

- **Identity** — government ID, verified against the registered mobile number
- **Business** — GST registration where the vendor is registered, or proof of trade otherwise
- **Work history** — photographs of at least five completed jobs, with the ability to name the locality and approximate date
- **Reference calls** — we speak to at least two past customers
- **Domain-specific approval** — approval is granted per trade. A fabricator approved for fabrication cannot start taking painting leads by ticking a box; that is a separate approval.

## Continuously

- Rating is tracked per domain, so a vendor who is strong at one trade and weak at another shows exactly that on their profile
- Response time is measured, not self-reported
- Two unresolved complaints move an account to review; an account under review stops receiving new leads

## When something goes wrong

Raise it through the app rather than directly with the vendor. A ticket puts a named person from our side on it, and creates a record. Complaints raised over a phone call to a vendor leave no trace and are, in our experience, the ones that do not get resolved.

## What verification does not cover

We verify the vendor. We do not supervise every site daily. Read the reviews, meet all three assigned professionals rather than only the first, and take the site visit seriously — it is the point at which most avoidable problems are still cheap to avoid.`,
  },
  {
    slug: "false-ceiling-worth-it",
    title: "Is a False Ceiling Worth It? An Honest Answer",
    excerpt:
      "It costs upwards of a lakh in a 2BHK, eats ceiling height, and is not always the right call. Where it genuinely earns its money and where it does not.",
    category: "bcat-guides",
    tags: ["btag-budget"],
    domainId: "dom-interior",
    author: "Imran Qureshi",
    authorRole: "Design-Build, Lucknow",
    publishedDaysAgo: 84,
    minutes: 5,
    body: `## What it actually buys you

Not decoration, primarily. A false ceiling buys you **lighting positions**. Without one you have a fan point and a tube light point, and you are stuck with them. With one you can place downlights, cove lighting and profile lighting where the room needs them.

It also conceals AC piping and ducting, which is the other legitimate reason to install one.

## What it costs you

- ₹95-130 per sq.ft depending on material and detail
- 100-150 mm of ceiling height for a peripheral design, more for a full ceiling
- A day of dust, and a firm sequence — it has to be done before painting and before most electrical finishing

## Where it is worth it

- **Living and dining** — where lighting layers change how the room feels at night, and where guests see it
- **Any room with a split AC or ducting to conceal**
- **Rooms with a slab height above 10 ft**, where the lost height is not felt

## Where it usually is not

- **Bedrooms in flats with a 9.5 ft slab**, where a peripheral cove is enough and a full ceiling makes the room feel low
- **Kitchens**, where grease and heat make it a maintenance problem
- **Rental properties**, where it does not raise the rent by anything close to its cost

## The middle path most people should take

A peripheral cove in the living and dining, plain ceilings elsewhere, and the money saved put into better lighting fixtures. Good fixtures in a plain ceiling beat cheap fixtures in an elaborate one, every time.`,
  },
];

export const blogPosts: BlogPost[] = seeds.map((s, i) => ({
  ...rec(200 - i * 2, s.publishedDaysAgo),
  id: `post-${s.slug}`,
  title: s.title,
  slug: s.slug,
  excerpt: s.excerpt,
  body: s.body,
  coverImageUrl: `ph:${(s.domainId ?? "dom-interior").replace("dom-", "")}:blog-${s.slug}`,
  authorName: s.author,
  authorRole: s.authorRole,
  categoryId: s.category,
  tagIds: s.tags,
  domainId: s.domainId,
  status: "published" as const,
  publishedAt: daysAgo(s.publishedDaysAgo),
  readingMinutes: s.minutes,
  seoTitle: `${s.title} | Home Services Guide`,
  seoDescription: s.excerpt,
  ogImageUrl: null,
  isFeatured: s.featured ?? false,
}));

export const banners: Banner[] = [
  {
    ...rec(90, 4),
    id: "ban-monsoon",
    title: "Beat the monsoon",
    subtitle: "Exterior painting + terrace waterproofing, booked together. One scaffolding, one crew, 5-year warranty.",
    imageUrl: "ph:painting:banner-monsoon",
    ctaLabel: "See the package",
    ctaHref: "/packages/monsoon-protection-package",
    domainId: "dom-painting",
    cityIds: [],
    isActive: true,
    sortOrder: 1,
  },
  {
    ...rec(90, 4),
    id: "ban-furniture",
    title: "Custom furniture in 15 days",
    subtitle: "Made to your measurements by verified carpenters. Compare three quotes before you commit.",
    imageUrl: "ph:furniture:banner-furniture",
    ctaLabel: "Browse furniture",
    ctaHref: "/catalogue/furniture",
    domainId: "dom-furniture",
    cityIds: [],
    isActive: true,
    sortOrder: 2,
  },
  {
    ...rec(90, 4),
    id: "ban-fabrication",
    title: "New: gates, grills & railings",
    subtitle: "Powder-coated steel fabrication with proper pre-treatment. Measured, made and installed.",
    imageUrl: "ph:fabrication:banner-fabrication",
    ctaLabel: "Explore fabrication",
    ctaHref: "/catalogue/fabrication",
    domainId: "dom-fabrication",
    cityIds: [],
    isActive: true,
    sortOrder: 3,
  },
  {
    ...rec(90, 4),
    id: "ban-interior",
    title: "Full home interiors from ₹5.49L",
    subtitle: "Three designers, three quotes, one decision. Free consultation and 3D views before you pay anything.",
    imageUrl: "ph:interior:banner-interior",
    ctaLabel: "Book free consultation",
    ctaHref: "/submit-requirement",
    domainId: "dom-interior",
    cityIds: [],
    isActive: true,
    sortOrder: 4,
  },
];

export const testimonials: Testimonial[] = [
  {
    ...rec(120, 30),
    id: "tst-1",
    clientName: "Ritu Agarwal",
    cityName: "Lucknow",
    domainId: "dom-interior",
    rating: 5,
    quote:
      "I got three quotes in four days and they were genuinely comparable, which is what I could not manage on my own. The designer we picked finished a week early.",
    avatarUrl: null,
  },
  {
    ...rec(120, 30),
    id: "tst-2",
    clientName: "Sandeep Mishra",
    cityName: "Kanpur",
    domainId: "dom-painting",
    rating: 5,
    quote:
      "Booked painting and waterproofing together before the monsoon. The crew covered everything properly and cleaned up each evening — no repainting the floor afterwards.",
    avatarUrl: null,
  },
  {
    ...rec(120, 30),
    id: "tst-3",
    clientName: "Farah Siddiqui",
    cityName: "Lucknow",
    domainId: "dom-furniture",
    rating: 4,
    quote:
      "Wanted only a dining table and did not want a full interior consultation. Took me ten minutes to raise the request and three carpenters came back with sizes and prices.",
    avatarUrl: null,
  },
  {
    ...rec(120, 30),
    id: "tst-4",
    clientName: "Col. R. P. Singh",
    cityName: "Lucknow",
    domainId: "dom-fabrication",
    rating: 5,
    quote:
      "The gate and the railings were made by the same fabricator so they match. Powder coating has held up through two monsoons without a mark.",
    avatarUrl: null,
  },
];
