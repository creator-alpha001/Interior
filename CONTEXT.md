# Aangan — project context

Where this project stands, why it is built the way it is, and what is left.

Read this first if you are picking the work up. `README.md` covers running it,
`API.md` is the endpoint contract, `DEPLOYMENT.md` covers hosting. This file is
the history and the roadmap.

---

## What it is

A marketplace connecting customers to verified professionals across four trades
— **Interior Design, Furniture Work, Fabrication and Painting** — with the
platform coordinating every conversation between the two sides.

It is not only a service marketplace. Customers browse a catalogue of products
and packages, select something, and a vendor then makes that exact piece for
them. The blog exists to rank and bring people in.

```
apps/web      Customer site + professional portal at /partner   (Next.js, 3001)
apps/admin    Internal ops and admin panel                      (Next.js, 3002)
apps/api      Fastify + PostgreSQL — owns every write            (4000)

packages/types      Entities and view models. The response contract.
packages/contract   Zod input schemas + the route manifest. The request contract.
packages/data       The repository layer every screen imports from.
packages/mock       Seed data — also the API's seed source.
packages/ui         The design system, shared by both frontends.
```

**51 tables. 96 endpoints. 3 migrations.**

---

## The decisions everything else follows from

These were settled with the client and are not open questions. Changing one
changes the product, not just the code.

**Customers and vendors never contact each other.** Every message thread has the
platform on one side. Vendors get a masked customer — first name and initial,
locality up front, the full address only once a visit for *that service* is
confirmed, and never a phone number. This is the platform's whole proposition:
if a vendor can reach the customer directly, the relationship and the commission
go with them, and the customer loses the person they can complain to.

**Assignment is manual.** Ops phone the vendor, confirm they can take it, then
assign. Nothing is auto-matched.

**A lead fans out into `lead_domains`, one row per service.** Everything —
assignment, quoting, visits, agreements, execution — hangs off that, never off
the lead. "Just a dining table" and "2BHK + painting + a steel gate" run through
identical code paths.

**Agreements group by professional, not by service.** The same vendor hired for
two trades gets one contract and one commission invoice; execution stays tracked
per service, because a painting job finishing does not mean the furniture job
has.

**Commission accrues on the agreed price at signing**, at the vendor's rate for
that trade, frozen at that moment. A later override does not reprice work
already agreed. It is shown on the vendor's side only.

**Trades are approved per vendor.** A good carpenter is not automatically a good
painter. Ratings are held per trade too.

**A stage is done when somebody checked.** Vendors close out project stages by
uploading photographs; ops approve them; only an approval moves the customer's
progress bar.

**Nothing is hardcoded to four trades.** Adding "Electrical Work" is an admin
action, not a release.

**Payments stay off-platform** for now. Terms are recorded, not enforced.

### Stack

| | | Why |
|---|---|---|
| Node 22 + TypeScript | `apps/api` | Shares `packages/types` with both frontends, so a response that drifts from what a screen renders is a compile error |
| Fastify | HTTP | Light; Zod validation and OpenAPI from one schema |
| PostgreSQL 16 | database | Deeply relational, needs real transactions, and several invariants become constraints |
| Drizzle | ORM | Schema is TypeScript; migrations are readable SQL |
| Mobile OTP | customers, vendors | Phone-first India; tradespeople will not manage passwords |
| Password + TOTP | staff | Ops see every customer's number and every vendor's margin |
| Railway + Vercel | hosting | One long-running API (real transactions, background jobs); frontends stay where they are |
| Cloudflare R2 | files | S3 API, no egress fees |
| MSG91 | SMS | Indian transactional SMS needs a DLT-registered template |

---

## Where it stands

Six of eight phases. **Every surface runs on PostgreSQL.**

| | Phase | State |
|---|---|---|
| M0 | Foundation — schema, migrations, invariants, seed | done |
| M1 | Authentication — OTP, staff login, sessions | done |
| M2 | Public reads — catalogue, blog, directory, search | done |
| M3 | Uploads + customer surface | done |
| M4 | Vendor portal | done |
| M5 | Ops panel | done |
| **M6** | **Background jobs and notifications** | **next** |
| **M7** | **Hardening** | |

Set `NEXT_PUBLIC_API_URL` on both frontends and nothing reads seed data.
`NEXT_PUBLIC_ALLOW_DEMO_SESSION=true` still forces the seeded identities for a
demo; it is ignored in a production build.

---

## What was built

**M0 — Foundation.** 51 tables derived from `packages/types`. Three departures
from the TypeScript shapes: project milestones and ticket replies became real
tables (both are addressed individually and written by two parties), and media
became a table (uploads now go through a ticket flow, so a file exists before
the form referencing it is submitted). Everything else that was an embedded
array stayed JSONB.

`0002_invariants.sql` is where the value is. Eleven rules that lived only in
application code became constraints: one project per service, one invoice per
agreement, one review per project, one live quote per vendor, one live partner
agreement. A check constraint makes a message crossing the client/vendor channel
unrepresentable. A composite foreign key makes it impossible to select a quote
belonging to a different service. `leads.overall_status` and project completion
became triggers. Reference numbers moved to sequences.

**M1 — Authentication.** Sessions are rows, not JWTs — revocation has to be
immediate, because suspending a vendor must log them out of a portal they are
looking at. OTP codes are stored as argon2 hashes. Rate limits live in Postgres,
because an in-process counter gives an attacker one allowance per instance.

**M2 — Public reads.** Catalogue, packages, blog, directory, search. Cursor
pagination throughout. A vendor's rating *in the trade being browsed* is what
ranks them.

**M3 — Uploads and the customer surface.** 19 endpoints under `/me`.
`signAgreement` is the largest transaction in the system — five tables, all or
nothing, with the agreement row locked. Verification moved to the *end* of the
public requirement form: everything typed stays in the browser, a code confirms
the number, and the account and requirement are created in one action.

**M4 — Vendor portal.** 16 endpoints. Masking is structural rather than
procedural: `MaskedClientSummary` has no field for a phone number or an email,
and no query in the module selects `users.mobile`. Address release is computed
in SQL beside the query.

**M5 — Ops panel.** 33 endpoints. Permissions enforced against
`AdminRole.permissions`, which existed in the model and nothing read. The lead
queue is paged and the dashboards are SQL aggregates.

---

## Bugs found and fixed along the way

Worth knowing, because several were invisible until something specific was
tried.

| Bug | Where it came from |
|---|---|
| A quote from an unrelated service could be selected, with its price and its vendor | `selectQuote` never checked. Now a composite foreign key |
| `leads.overall_status` went stale after four mutations | Documented as derived; only three of seven call sites recomputed it. Now a trigger |
| A vendor could write `completionPercent` directly | `updateProjectProgress`, plus a UI component rendered nowhere. Both deleted |
| Assignment never re-checked eligibility | Trusted the pool, which can be minutes old. Now re-checked inside the transaction |
| Suspending a vendor destroyed every trade approval, irreversibly | Reinstating left them approved for nothing. Suspension is now a vendor-level state |
| `/account` and `/partner` were statically prerendered | One person's data baked into a build artifact. Now `force-dynamic` |
| Session wiring silently did nothing | Registered from `instrumentation.ts`, which Next builds as a separate module graph. Every request rendered signed out with no error |
| OTP inputs kept only the last character | SMS autofill drops all six digits into the first field; five vanished |
| "Continue with Google" pushed straight to `/account` with no authentication | Prototype leftover. Removed |
| `replyToTicket` took the author's name from the caller | Anybody could sign a reply with anybody else's name |
| `= ANY(${array})` expanded to a parameter list, not an array | Three ops queries 500'd. Now `sql.param` with `::uuid[]` |
| Reference numbers were generated by counting rows | Raced, and collided across years. Now sequences |
| A high-severity SQL injection in `drizzle-orm` | GHSA-gpj5-g38j-94v9. Upgraded |
| Duplicate footer link | Caused a React key warning on every page |

---

## What remains

### M6 — Background jobs and notifications

Nothing runs on a schedule yet, and notifications are written to the database
but never delivered.

- **pg-boss** (Postgres-backed, no Redis) with jobs enqueued *inside* the
  transaction that causes them, so an SMS is never sent for a write that rolled
  back
- `invoice.mark-overdue` — nightly. **Nothing currently sets `overdue`**, so the
  status is read but never reached
- `notification.dispatch` — sends SMS and push for rows in `notifications`
- `otp.sweep`, `lead.stale-alert`, `followup.due`, `media.orphan-sweep`
- **MSG91 wiring** — the client is written; it needs an account and a
  DLT-registered template
- `AuditLog` written for every staff mutation. The table exists and is unused

### M7 — Hardening

- Rate limits on every mutation, not just the auth paths
- Sentry, structured logs with request ids
- Automated backups **with a tested restore**
- A load test on the ops lead queue
- Postgres RLS as defence in depth

### Outside the milestone plan

- **The two mobile apps** (customer and professional, Expo). In the original
  spec, never started. Comparable in size to everything done so far
- **Paging controls in the UI.** The data layer pages; no screen renders a "next
  page" button. Current page sizes cover the seed data, not 50,000 leads
- **Object storage.** Upload tickets are issued and rows written, but no bucket
  is configured — the PUT has nowhere to go in development
- **Real photography.** The catalogue renders designed placeholder tiles from
  `ph:` tokens. The `Media` component already handles normal URLs
- **Payments**, if the off-platform decision changes. Its own phase, with the
  most regulatory weight
- **A month-grid calendar** for site visits

### Non-code work with lead times

Start these in parallel — they cannot be compressed at the end.

- **DLT registration** for the SMS sender id and template. Mandatory in India,
  days to weeks. **Nobody can sign in without it**
- Railway, managed Postgres, and Cloudflare R2 accounts
- Photography

---

## Things to know before changing anything

**Screens import `@repo/data` and nothing else.** No screen imports `@repo/mock`
or the store. That seam is what let the frontend be built before the backend
existed, and it is what makes each surface switchable one at a time.

**No function takes the caller's own id.** `listLeadsForClient()` asks who is
signed in rather than accepting a `clientId`. Ids are parameters only for
records being *addressed*, never for the caller.

**Personal endpoints switch on whether there is a session**, not on whether a
backend is configured. `callingApiAsUser()`, not `USING_API`. With the demo flag
on, the other check would have screens believing they were signed in while the
API answered 401.

**A record belonging to somebody else answers 404, not 403.** A 403 confirms it
exists.

**The seed is the demo.** `db:seed` loads the same rows the frontends used, so
the walkthrough — one requirement seen from all three sides — works against
Postgres. Re-seeding truncates `sessions`, so you will be signed out.

**The API must be reachable at build time once `NEXT_PUBLIC_API_URL` is set.**
Pages like `/blog` and `/domains` are statically generated, so `next build`
fetches from the API — and fails the build if it cannot. Worth knowing before
the first deploy that has both: the API needs to be up before the frontends
build, and a scheduled rebuild during API downtime will fail rather than serve
the previous version.

**Triggers recompute derived values during seeding.** Project completion follows
approved milestones and ratings follow reviews, so seeded values that disagreed
with their underlying rows are corrected on load. That is the derivation
working.

---

## Verification done so far

Everything below was run against a real PostgreSQL instance, not asserted.

**Invariants** — attempted the violation and confirmed the database refused it:
double invoice, second project per service, client message carrying a vendor id,
vendor writing to the client thread, duplicate quote version, a quote from
another service, a vendor not matching the winning quote.

**Transactions** — a failure injected on the invoice insert during
`signAgreement` left no project, no stage, no invoice and the agreement
unsigned.

**Masking** — 42 seed phone numbers and emails checked against 13 vendor
endpoints and 6 rendered portal pages: zero appear. Address release verified
both ways by flipping the visit status.

**Eligibility** — a verified but unsigned vendor appears in no pool and cannot
be assigned even when their id is posted directly.

**Permissions** — a sales agent is refused `commission.manage`,
`vendors.verify` and `settings.manage`.

**Not yet covered:** none of this is an automated test suite. It was verified by
hand, once. **Writing these as integration tests is the highest-value work not
currently in any milestone** — the constraints are the product's guarantees, and
nothing currently stops a future change quietly removing one.
