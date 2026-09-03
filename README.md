# Aangan — multi-domain home services platform

A marketplace connecting customers to verified professionals across four trades — **Interior Design, Furniture Work, Fabrication and Painting** — with the platform coordinating every conversation between the two sides.

Two frontends and an API, sharing one type contract. The frontends run on seed data until `NEXT_PUBLIC_API_URL` is set; with it set, every surface runs on PostgreSQL.

**New to this?** `CONTEXT.md` has the project's state, the decisions behind it, and what is left.

---

## The surfaces

| App | Audience | Port | What it is |
| --- | --- | --- | --- |
| `apps/web` | Customers **and professionals** | 3001 | Public site — catalogue, packages, blog, estimator, requirement form, client dashboard — plus the professional portal at `/partner` |
| `apps/admin` | Internal staff | 3002 | Sales queue, the relay console, vendor verification, commission, domain configuration, reporting |
| `apps/api` | Both, plus the mobile apps later | 4000 | Fastify + PostgreSQL. Owns every write, every authorisation rule, and the money |

```bash
npm install
npm run dev:web      # or dev:admin, dev:api
npm run build        # builds both frontends
```

Running the API needs a database:

```bash
docker compose up -d                      # or point at your own Postgres
cp apps/api/.env.example apps/api/.env
npm run db:migrate && npm run db:seed
npm run dev:api
```

`db:seed` loads the same rows the frontends use, so the demo walkthrough — one requirement seen from all three sides — works identically against Postgres.

The professional portal lives at `/partner` on the customer site, so vendors sign in at the same address customers use rather than needing a URL of their own. The admin panel stays a separate deployment — it carries commission figures, vendor margins and customer contact details, and that is worth keeping as a network boundary rather than a route check.

Each surface is signed in as a fixed demo identity — Priya Sharma as the customer, Studio Aarohi Interiors in the portal, Kavita Bisht in ops. They live in one place, `DEMO_ACTORS` in `packages/data/src/session.ts`, and are used only because no session resolver is registered yet. Each app registers one in `src/instrumentation.ts`; filling in that callback is what turns the demo identities off.

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
packages/contract Zod schemas for every request, and the route manifest. The
                 runtime half of the contract: @repo/types says what a shape is,
                 this checks that something actually is one.
packages/ui      The design system, shared across both frontends.
```

**The seam that matters:** screens call `@repo/data`, never `@repo/mock`. Today those functions resolve against an in-memory store; when the backend lands, only the function bodies change. Signatures, view models and screens stay as they are.

Set `NEXT_PUBLIC_API_URL` on both apps and the whole platform runs on Postgres — catalogue, sign-in, the customer account, the professional portal and the ops panel. `NEXT_PUBLIC_ALLOW_DEMO_SESSION=true` still forces the seeded identities for a demo, and is ignored in a production build. `API.md` is the contract.

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

**Customers and vendors sign in with a mobile number and an SMS code; staff with a password and an authenticator app.** An ops account can see every customer's number and every vendor's margin, so it should not be reachable by whoever ends up with a recycled SIM. Sessions are rows in Postgres, not JWTs, because suspending a vendor has to log them out of the portal they are looking at.

**No function takes the caller's own id.** `listLeadsForClient()` asks who is signed in rather than accepting a `clientId`, because the day that argument comes from a browser is the day one customer can read another's leads. Ids are parameters only for records being *addressed*, never for the caller.

**Lists that grow return a page, not an array.** `listProducts`, `listPosts` and `listProfessionals` return `{ items, nextCursor, total }`. Retrofitting that later would have meant touching every call site.

**Invariants live in the database, not only in code.** One project per service, one invoice per agreement, one live quote per vendor, and a message that cannot cross the client/vendor channel — all partial unique indexes, check constraints and triggers in `apps/api/drizzle/0002_invariants.sql`. Application code can forget; a constraint cannot.

---

## Not built yet

- Background jobs: nothing marks an invoice overdue yet, and notifications are written but never sent as SMS
- Object storage: upload tickets are issued and rows written, but no bucket is configured
- The two mobile apps (client and professional)
- Paging **controls** in the UI — the data layer pages, but no screen yet renders a "next page" button; today's page sizes cover the seed data
- Ops lists (`listOpsLeads`, `listVendors`) are unpaged, because the dashboards aggregate across every row. Those aggregates need their own endpoints before those lists can page
- A month-grid calendar for site visits

Catalogue and portfolio imagery is rendered as designed placeholder tiles from `ph:` tokens in the seed data. Swapping in real photography means changing those strings — the `Media` component already handles normal image URLs.
