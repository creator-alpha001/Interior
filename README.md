# Aangan — multi-domain home services platform

A marketplace connecting customers to verified professionals across four trades — **Interior Design, Furniture Work, Fabrication and Painting** — with the platform coordinating every conversation between the two sides.

This is the **frontend build**: three applications running against a shared in-memory data layer with realistic seed data. No backend yet; the data layer is deliberately shaped so it can be swapped for real API calls without touching a single screen.

---

## The three surfaces

| App | Audience | Port | What it is |
| --- | --- | --- | --- |
| `apps/web` | Customers **and professionals** | 3001 | Public site — catalogue, packages, blog, estimator, requirement form, client dashboard — plus the professional portal at `/partner` |
| `apps/admin` | Internal staff | 3002 | Sales queue, the relay console, vendor verification, commission, domain configuration, reporting |

```bash
npm install
npm run dev:web      # or dev:admin
npm run build        # builds both
```

Each app is signed in as a fixed demo identity (see each app's `src/lib/session.ts`) — Priya Sharma on the customer site, Kavita Bisht in ops, Studio Aarohi Interiors in the vendor panel. That single constant becomes a session lookup when auth is built.

---

## Shared packages

```
packages/types   The full data model as TypeScript types, including the view
                 models each screen renders. This doubles as the API contract.
packages/mock    Seed data — 59 catalogue products, 15 packages, 8 blog posts,
                 12 professionals, and a demo customer journey covering every
                 stage from enquiry to completed project.
packages/data    The repository layer. Every screen imports from here and
                 nowhere else.
packages/ui      The design system, shared across both apps.
```

**The seam that matters:** screens call `@repo/data`, never `@repo/mock`. Today those functions resolve against an in-memory store; when the backend lands, only the function bodies change. Signatures, view models and screens stay as they are.

---

## Design decisions worth knowing

These shape the whole system, so they are worth reading before changing anything.

**Nothing is hardcoded to four trades.** Every lead, quote, agreement, project, invoice and report reads a `domainId`. Adding "Electrical Work" is an admin action in Domain Management, not a release.

**One lead fans out into `lead_domains`, one row per service.** Each tracks its own material source, assignment, quotes and execution independently. "Just a dining table" and "2BHK interior + painting + a steel gate" run through identical code paths.

**Agreements group by professional, not by service.** Different professionals across services means one contract each. The same professional across several services collapses into a single combined agreement — one document, one commission invoice — while execution stays tracked per service, because a painting job finishing does not mean the furniture job has.

**Customers and vendors never contact each other.** Every message thread has the platform on one side of it. Vendors receive a masked customer — first name and initial, locality up front, full address only once a visit is confirmed, and never a phone number. This is enforced in the data layer, not the UI.

**Ratings are held per trade.** A vendor who is excellent at painting and average at carpentry shows exactly that.

**Vendors sign a partner agreement before they can be assigned anything.** An unsigned account is excluded from every vendor pool, no matter how verified it is.

**A stage is done when somebody checked, not when somebody said so.** Vendors close out project stages by uploading photographs; ops approve them; only then does the customer's progress bar move.

---

## Not built yet

- Backend, database and real authentication — the data layer is the seam for these
- The two mobile apps (client and professional)
- Blog pagination; a month-grid calendar for site visits

Catalogue and portfolio imagery is rendered as designed placeholder tiles from `ph:` tokens in the seed data. Swapping in real photography means changing those strings — the `Media` component already handles normal image URLs.
