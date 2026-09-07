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

All eight phases. **Every surface runs on PostgreSQL.**

| | Phase | State |
|---|---|---|
| M0 | Foundation — schema, migrations, invariants, seed | done |
| M1 | Authentication — OTP, staff login, sessions | done |
| M2 | Public reads — catalogue, blog, directory, search | done |
| M3 | Uploads + customer surface | done |
| M4 | Vendor portal | done |
| M5 | Ops panel | done |
| M6 | Background jobs, notifications, audit trail | done |
| M7 | Hardening — tests, limits, RLS, load, backups | done |
| M8 | Mobile API — bearer sessions, storage and SMS drivers, push, closure | done |

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

**M6 — Jobs, notifications and the audit trail.** Eight scheduled jobs on
pg-boss, all on Asia/Kolkata. Every one is **idempotent** and every one can be
run by hand — `npm run job -- invoice.mark-overdue` — so a missed night is
replayed in a second rather than waited out until the next tick. Each returns
how much it handled, which is what makes a run verifiable rather than hopeful.

| Job | When | Does |
|---|---|---|
| `invoice.mark-overdue` | 02:00 daily | Pending invoices past their due date; notifies the vendor once |
| `notification.dispatch` | every 2 min | Drains the outbox to SMS, 50 at a time |
| `followup.due` | 08:00 daily | Tells each agent which follow-ups are due today |
| `lead.stale-alert` | 08:30 daily | Leads 14 days old with nothing completed |
| `otp.sweep` | hourly | Deletes expired challenges |
| `media.orphan-sweep` | Sun 03:00 | Assets no row references |
| `session.sweep` | Sun 03:30 | Expired sessions |
| `ratelimit.sweep` | 03:45 daily | Spent rate-limit windows |

Notifications are an **outbox**, not a send. A row is written inside the
transaction that causes it and a job delivers it afterwards, so an SMS is never
sent for a write that rolled back — the ordering that a direct send inside a
handler cannot give you.

The **audit trail** is a hook, not a call in each handler. Every non-GET request
to `/ops/*` that returned under 400 gets a row with the actor, the route pattern
as the action, a readable summary, the whitelisted changed fields and the IP.
There are twenty-odd staff mutations and there will be more; a helper somebody
has to remember to call is a trail with holes, and the holes are always in the
routes added last. Message and reply bodies are deliberately not copied in —
they are already stored as messages, and duplicating a customer's words doubles
where they live for no gain. Writing a row never fails a request.

**M7 — Hardening.** The phase that turned the guarantees from claims into
checks, and found four real bugs doing it.

**An automated suite, 61 integration tests against a real database**, rebuilt
from the migrations on every run so a migration that works forward from a
developer's database but not from an empty one fails here rather than on a
deploy. The constraint tests attempt the violation and assert Postgres refuses
it *citing the constraint by name* — half of them failed first time because the
test SQL had a wrong column, and a looser assertion would have called that a
pass. The masking sweep signs in as a vendor who actually holds leads, walks
every `/vendor` GET and greps the bodies for every contact detail in the
database; it was verified by injecting a leak, which failed three endpoints and
named the customer. A test that cannot find its fixture reports as skipped
rather than passing silently.

**Rate limits on every mutation**, as a hook rather than a decorator per route,
keyed by session where there is one and by address otherwise. The session token
is hashed before it becomes a key: the rate-limit table gets read during
incidents and should not be a list of live sessions.

**Request ids** generated in the proxy, carried by `@repo/data` to the API,
echoed on every response and attached to every log line — a page render and the
API calls behind it are separate processes, and this is what makes them one
story. An inbound id is accepted only if it looks like an id.

**Sentry**, off unless a DSN is set, with bodies, cookies, query strings and
user records stripped on the way out.

**Backups with a drill**: dump, restore into a scratch database, compare every
table's row count, drop the scratch. An untested restore is a belief.

**A load test at fifty thousand leads**, which is the only reason any of the
query work below happened — the seed has a dozen, so none of these queries had
ever met a table with an opinion. Four of six screens were over a 300ms budget
and My Day took 1.1 seconds.

**Row-level security, and the three database roles that make it mean
something.** A customer or vendor request runs on a reserved connection carrying
their identity; the policies read it, and a query written without its `WHERE`
returns nothing instead of somebody else's requirement. Three things had to be
discovered rather than designed — each caught by a test:

- a **superuser bypasses row-level security entirely**, so the first version was
  complete, forced and inert;
- the policies **recursed**, because a lead is visible through its services and a
  service through its lead;
- and they **cost the ops screens 150ms for nothing**, since staff read across
  everybody anyway and were only paying for the check.

Hence `aangan_app` (no superuser, subject to the policies), `aangan_ops`
(BYPASSRLS and no other extra privilege) and the owner (migrations, seed,
backups). See **Signing in** below for how they are configured.

**M8 — What the mobile apps need, and the end of three blocking dependencies.**
Planned in `MOBILE.md`; the API half is built.

Bearer sessions sit on the existing session table rather than beside it: a
mobile client sends `X-Client: mobile` and gets `sessionToken` back, then sends
it as `Authorization: Bearer`. Same 32 random bytes, same SHA-256 in the
database, same immediate revocation — deliberately **not a JWT**, for the reason
sessions were rows in the first place. One function reads the token, so the
route guards, the row-level-security scope hook and the write limiter all
inherited it at once.

The rest of the phase was a single principle: **an account with a lead time must
not be able to stop the platform running.** Three dependencies could, and each
now has a working local path selected by `auto` and named in the startup log.

| Was | Now |
|---|---|
| No bucket meant upload tickets pointed at a URL that returned nothing — requirement photos, stage proof, portfolio and vendor documents could all be clicked through and none worked | Two drivers. `r2` presigns at Cloudflare; `local` presigns at this API, HMAC-signed exactly as the R2 one is, and serves the files back. In production `auto` **refuses** to fall back — ephemeral container disk is a data loss with no error — so local there is an explicit choice with a mounted volume |
| The API refused to boot without MSG91, on the reasoning that nobody could sign in | A warning. `console` writes the code to the log; `file` appends to an outbox somebody tails and sends by hand. A pending DLT registration leaves a platform an operator can work through |
| `device_tokens` had existed since 0001 and nothing had ever read it | Read. FCM v1 with a `log` driver, tokens bound to the **session** so signing out takes exactly that handset, and dispatch folded into the notification outbox rather than beside it |

Also: `POST /me/account/delete`, which both stores require and which is not
erasure — personal detail is cleared and the row soft-deleted, freeing the
number, while agreements, invoices and reviews stay, because they are commercial
records with a second party. And `GET /app/version`, which is the only lever
there is once a bad build is on somebody's phone.

Two bugs surfaced doing it. The **write rate limiter read the cookie directly**,
so every mobile write would have been keyed by IP and charged the anonymous
40-per-five-minutes allowance rather than 300 — behind a carrier's NAT, one
allowance shared across a great many customers. And the **storage path guard
sanitised rather than refused**: `../../../etc/passwd` became `etc/passwd`,
safely inside the media directory and therefore silent.

A third thing had to be discovered rather than designed, and it is the same
shape as the row-level-security surprises in M7: **registering a device fails
under the policies**. When a handset changes hands the row belongs to its
previous owner and is invisible to the new one — but the unique index on `token`
is enforced regardless of visibility, so the upsert does not update, it fails on
a row the caller cannot see. The write runs on the unscoped pool; the user id
still comes from the session and is never a parameter.

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
| **Every multi-table write on `/me` and `/vendor` returned 500** once row-level security was on. A scoped request runs on a connection from `postgres.reserve()`, and a reservation does not carry `begin` — that is defined on the pool — so drizzle's `transaction` threw `this.client.begin is not a function` on every one. `POST /me/agreements/:id/sign`, the largest transaction in the system, failed for every customer. `transaction()` now issues BEGIN and COMMIT by hand on a reservation, which is safe precisely because it is one connection |
| **A customer could not sign an agreement**, for a second and separate reason. Every policy in 0005 and 0007 was `FOR ALL USING (...)` with no `WITH CHECK`, so Postgres applied the *read* rule to writes — and signing raises the **vendor's** commission invoice inside the customer's transaction. The read rule was right and was standing in for a write rule it should never have been. Migration 0009 splits them: customers may create that invoice and still cannot read one |
| A high-severity SQL injection in `drizzle-orm` | GHSA-gpj5-g38j-94v9. Upgraded |
| Duplicate footer link | Caused a React key warning on every page |
| An admin logging a call got a 500 | Their user id was written to a column referencing `sales_agents`. The column answers "which agent owns this lead", not "who made this call". The agent is now optional and every row carries the user who made the call |
| Fastify's own 4xx errors were reported as 500 | A malformed body or an oversized payload sent the caller looking for a server fault that was not there |
| `npm run typecheck` never worked | It referenced a root `tsconfig.json` that has never existed, and neither Next app had the script it called. Both fixed |
| An admin's calls vanished from the queue, the call log and the timeline | Making the sales agent optional left three queries inner-joining through it. Nothing errored — rows simply stopped appearing, and a lead read "never called" the morning after somebody called it |
| The ops dashboards asked each question once per lead | Counting unassigned services ran an index scan per lead; counting customers awaiting a reply ran a **sequential scan of the messages table** per lead, fifty thousand times |
| Searching the lead queue read the whole table | A leading-wildcard `LIKE` with no trigram index. 355ms at fifty thousand leads, and linear in the business |
| Row-level security was inert | The API connected as a superuser, which bypasses it completely — policies, `FORCE` and all |

---

## What remains

### Still open from M6

The jobs, the outbox and the audit trail are done and verified. What is left is
account-level, not code:

- **MSG91 still needs an account and DLT-registered templates**, and that is
  still days to weeks — but M8 removed it from the critical path. `SMS_DRIVER`
  falls back to `console` or `file`, so sign-in works and an operator can send
  codes by hand until the registration lands. What each notification actually
  achieved is now recorded on the row (`delivery_channel`, `delivery_note`),
  so "did they hear about this?" is a query rather than a grep
- **Push is wired** (M8). It needs a Firebase project to leave the building;
  `PUSH_DRIVER=log` until then, and nothing is lost — the notification is still
  written and still goes out by SMS

### Still open from M7

- **Deployment steps for the two roles.** Migration 0005 creates `aangan_app`
  and `aangan_ops` without a login, deliberately — a password in version control
  is not a password. Once, after migrating:

  ```
  ALTER ROLE aangan_app WITH LOGIN PASSWORD '...';
  ALTER ROLE aangan_ops WITH LOGIN PASSWORD '...';
  ```

  then set `DATABASE_URL`, `OPS_DATABASE_URL` and `OWNER_DATABASE_URL`. **If the
  service keeps connecting as a superuser, row-level security does nothing** —
  silently, with every test still passing, because the tests run as the
  restricted role.
- **The backup drill is a script, not a schedule.** `npm run db:restore-drill`
  works and has been run; nothing runs it nightly yet.
- **Sentry needs an account and a DSN.** Reporting is off without one.
- **Row-level security covers eight tables**, the ones where a leak is worst:
  leads, services, messages, quotes, projects, agreements, commission invoices
  and notifications. Media assets, reviews and support tickets are still
  protected by the repository alone.

### Outside the milestone plan

- **The two mobile surfaces** (customer and professional). In the original spec,
  never started. Comparable in size to everything done so far. Planned in
  **`MOBILE.md`** — **Flutter, not Expo**, one binary with two role shells. The
  API side is now built (M8 below); the app itself is not
- **Paging controls in the UI.** The data layer pages; no screen renders a "next
  page" button. Current page sizes cover the seed data, not 50,000 leads
- **The R2 bucket.** Not blocking any more: `STORAGE_DRIVER` falls back to local
  disk, so the whole upload flow works without one. Production refuses that
  fallback unless it is chosen explicitly, so a bucket is still what a real
  deployment wants. Reads are public under both drivers, which is right for a
  photograph behind an unguessable uuid and wrong for `vendor_document` —
  signed read URLs are the remaining piece
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

## Signing in (development only)

Every one of these was checked against a running API and a seeded database, not
copied from a script. **None of it works in production**, by construction: the
seed refuses to set staff passwords when `NODE_ENV=production`, and the config
refuses to boot with `OTP_DEV_ECHO=true` there.

### Staff — email and password

`POST /auth/staff/login`, or the sign-in form on the admin app (port 3002).

| Who | Email | Role |
|---|---|---|
| Admin | `admin@example.com` | every permission |
| Kavita Bisht | `kavita@example.com` | sales agent, owns most seeded leads |
| Amit Tiwari | `amit@example.com` | sales agent |

Password for all three: **`aangan-dev-password`** — override with
`SEED_STAFF_PASSWORD` before seeding.

No TOTP is seeded, so the second factor is skipped. Once a staff account
confirms an authenticator, login on that account requires the code and the
seeded password alone stops being enough.

The admin and the agents see different things on the same screens: an agent's
My Day and dashboard are their own queue, and an admin — who has no queue —
sees every agent's work rather than an empty page.

### Customers and vendors — mobile OTP

There is no password. Set `OTP_DEV_ECHO=true` (it is already set in
`apps/api/.env`) and the request returns the code in the response as `devCode`:

```
POST /auth/otp/request   { "mobile": "9839012477" }
  -> { "challengeId": "...", "expiresInSeconds": 300, "devCode": "484220" }
POST /auth/otp/verify    { "challengeId": "...", "code": "484220" }
  -> sets the session cookie
```

Ten digits or the 91-prefixed form both work. An **unrecognised** mobile signs
up as a new customer — that is the intended flow, not a fallback.

| Who | Mobile | Good for |
|---|---|---|
| Priya Sharma | `9839012477` | customer with three leads, agreements and a live project |
| Vikram Nair | `9455670092` | customer, lighter history |
| Aarohi Verma | `9810000000` | verified vendor, signed, receiving leads |
| Rakesh Yadav | `9810040737` | verified vendor |
| Mohd Arif | `9810081474` | verified but **unsigned** — proves the agreement gate |

Mohd Arif is the useful one for testing the gate: verified, and still in no
pool anywhere until the partner agreement is signed.

### The database roles

Not a credential so much as a configuration, but it belongs next to them —
getting it wrong disables a security control without any sign that it has.

| Role | Used by | Why |
|---|---|---|
| `aangan_app` | the running API | Not a superuser, so the row-level security policies apply to it |
| `aangan_ops` | staff requests (`/ops/*`) | `BYPASSRLS` and nothing else extra — staff read across everybody by design and were only paying for a check that passed every row |
| the owner | migrations, seed, backups, the restore drill | Creates tables and reads globally; the other two deliberately cannot |

```
DATABASE_URL=postgresql://aangan_app:.../aangan
OPS_DATABASE_URL=postgresql://aangan_ops:.../aangan
OWNER_DATABASE_URL=postgresql://owner:.../aangan
```

Migration 0005 creates both roles without a login. Grant it once, after
migrating:

```sql
ALTER ROLE aangan_app WITH LOGIN PASSWORD '...';
ALTER ROLE aangan_ops WITH LOGIN PASSWORD '...';
```

**A superuser bypasses row-level security completely.** If the service connects
as one, the policies are inert and nothing says so — every test still passes,
because the tests run as `aangan_app`.

### The frontends

`NEXT_PUBLIC_ALLOW_DEMO_SESSION=true` bypasses all of this and forces a seeded
identity, for a demo without a running API. It is ignored in a production build.
The web app also sits behind a preview password in `proxy.ts`.

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

## Verification

**`npm test` runs 111 integration tests against a real PostgreSQL database**,
built from the migrations on every run. Most of what follows is now automated
rather than remembered; where something was only ever checked by hand, it says
so.

```bash
npm test
```

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

**Jobs** — each proved by creating the condition and watching it clear.
`invoice.mark-overdue` on a backdated invoice reported `handled 1`, and `0` on
the second run — idempotence demonstrated rather than assumed. `lead.stale-alert`
proved by ageing LD-1042 to 16 days. The notification outbox drains and does not
re-send. All eight crons are registered on `Asia/Kolkata`.

**Audit trail** — staff mutations recorded with actor, entity, summary, changed
fields and IP; a failed assignment correctly recorded nothing, since a rejected
request is not a change.

**Sign-in** — all three paths exercised end to end: staff password, customer
OTP, vendor OTP.

**Scoped writes** — `tests/scoped-writes.test.ts`. A transaction inside an actor
scope commits, rolls back on a failure injected after the write, and leaves the
reserved connection usable afterwards rather than stuck in an aborted
transaction. A customer can raise the commission invoice their signature
produces and a deliberately unscoped `SELECT * FROM commission_invoices` in
their scope still returns nothing, while the vendor sees their own. Both halves
are asserted, because fixing the write by loosening the read would have been far
worse than the bug.

**Row-level security** — inside a customer's scope, a deliberately unscoped
`SELECT * FROM leads` returns only their own; a vendor cannot read a
competitor's quote or another vendor's invoice; a customer sees no commission
figure at all. The connection is checked for a leftover identity after every
scope closes, because one carrying the last person's id would be a leak dressed
as an optimisation. And the personal screens are exercised over HTTP with the
policies on — the risk with row-level security is not that it fails open, it is
that it fails closed and silently.

**Load** — 50,000 leads, timed on the staff pool, warm cache:

| Screen | Before | After |
|---|---|---|
| ops queue, first page | 306ms | 90ms |
| ops queue, searched | 355ms | 279ms |
| my day | 1140ms | 136ms |
| sales dashboard (agent) | 946ms | 106ms |
| sales dashboard (admin, all) | 1242ms | 118ms |

Cold, straight after seeding, the aggregate screens are roughly three times
those figures — worth knowing as the cost of a restart, not as the number to
design against.

**Restore** — dumped, restored into a scratch database, compared every table:
51 tables, 738 rows, all matching.

**Still verified by hand, once:** the `signAgreement` rollback (a failure
injected on the invoice insert left no project, no stage, no invoice and the
agreement unsigned) and the six rendered portal pages in the masking check. The
endpoint half of that masking check is automated; the rendered-page half is not.
