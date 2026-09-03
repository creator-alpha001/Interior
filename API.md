# API contract

What the backend has to provide for this frontend to work unchanged.

This is not aspirational — every endpoint below corresponds to a function the
screens already call, and every response type is a view model that already
exists in `packages/types`. A backend that satisfies this contract can be
connected by swapping the bodies in `packages/data`, with no changes to any
component.

**Read `packages/types/src/views.ts` alongside this document.** It is the
authoritative definition of every response shape named here.

---

## Conventions

**Base URL** — `NEXT_PUBLIC_API_URL`. When unset the apps run on seed data.

**Everything except the ops surface is built and running.** `apps/api` serves
the public catalogue, authentication, the customer account and the professional
portal against PostgreSQL. The staff section further down is still the contract
to build.

**One thing to know while the ops panel catches up.** The admin app still reads
seed data keyed by its own ids, so a real staff session finds nothing there. Run
that app with `NEXT_PUBLIC_ALLOW_DEMO_SESSION=true` until the ops surface lands.
The customer site needs no such flag.

**Authentication** — session cookie forwarded by the frontend. The backend
derives the caller from it. Endpoints below never take a `clientId` or
`professionalId` for *the caller* — only for records being addressed. This
matters: `GET /me/requirements` must return the signed-in customer's leads, not
whichever id the client asked for.

The frontend holds up its half of that: no data function accepts the caller's
own id. They ask `packages/data/src/session.ts`, which resolves the session from
the request cookie.

Personal endpoints — everything under `/me` and `/vendor` — switch on whether
there is *actually* a session, not merely on whether a backend is configured.
That distinction matters: with the demo flag on, a screen would otherwise
believe it was signed in while the API answered 401. Public data has no such
condition and switches on the base URL alone.

There is one bounded exception, for the migration window only, described above:
`NEXT_PUBLIC_ALLOW_DEMO_SESSION=true` keeps the demo identities working while
only part of the app is wired. It is ignored in a production build, so it cannot
become the way the system runs.

**Where the session is resolved.** `@repo/data` reads the request cookie itself
and calls `GET /me`; Next deduplicates that fetch per render, so a page asking
forty times makes one request. This was originally registered from each app's
`instrumentation.ts` and that does not work — Next builds instrumentation as a
separate module graph, so the registration lands on a different copy of the
module than the screens import, and every request renders as signed out with no
error to explain it. `configureSession` remains, for tests and for the mobile
apps later.

**Errors** — JSON body `{ code, message, details? }` with a meaningful status.
`packages/data/src/client.ts` maps these to `ApiError`, which the UI uses to
distinguish "not signed in" from "not found" from "server broke".

**Money** — whole rupees, integers. No paise anywhere.

**Dates** — ISO-8601 timestamps; `YYYY-MM-DD` where only a date matters.

**Pagination** — every list marked *paged* below returns
`{ items, nextCursor, total }` and accepts `limit` and `cursor`. The cursor is
opaque: the frontend passes back whatever it was given and never parses it, so
moving from offsets to keyset paging is a backend-only change. `limit` defaults
to 24. `total` counts rows matching the filters, ignoring the page.

---

## Public catalogue

| Method | Path | Response | Notes |
| --- | --- | --- | --- |
| GET | `/domains` | `Domain[]` | Active trades, sorted |
| GET | `/domains/:slug` | `Domain` | |
| GET | `/cities` | `City[]` | |
| GET | `/products` | `Paginated<ProductView>` | **Paged.** Filters: `domain`, `category`, `search`, `city`, `tags`, `maxPrice`, `sort` |
| GET | `/products/:slug` | `ProductView` | `city` affects `effectivePrice` |
| GET | `/products/:slug/related` | `ProductView[]` | |
| GET | `/categories` | `ProductCategory[]` | Filter: `domain` |
| GET | `/packages` | `PackageView[]` | Filter: `domain` |
| GET | `/packages/:slug` | `PackageView` | |
| GET | `/professionals` | `Paginated<ProfessionalSummary>` | **Paged.** Filters: `domain`, `city`, `search`, `verifiedOnly` |
| GET | `/professionals/:id` | `ProfessionalProfile` | |
| GET | `/portfolio` | `PortfolioItem[]` | Filter: `domain`. Approved items only |
| GET | `/posts` | `Paginated<BlogPostView>` | **Paged.** Filters: `category`, `tag`, `domain`, `search` |
| GET | `/posts/:slug` | `BlogPostView` | |
| GET | `/search` | `SearchResults` | `q`, `city` |
| GET | `/search/suggest` | `{ label, hint, href }[]` | Type-ahead; keep it fast |
| GET | `/posts/categories`, `/posts/tags` | `BlogCategory[]`, `BlogTag[]` | |
| GET | `/banners`, `/testimonials`, `/stats` | | Home page content |
| GET | `/catalogue/counts` | `{ domainId, products, packages }[]` | Home screen tiles |

**Every function in this section is already wired to these endpoints.** They
call the URL above when `NEXT_PUBLIC_API_URL` is set and fall back to seed data
when it is not, so this is the section to build first — it can be switched on
with no frontend change at all.

The one caller that genuinely wants every row is the sitemap, and it walks the
cursor via `collectAll()` rather than asking for an enormous page.

---

## Customer — built

All scoped to the signed-in customer, and **none of them takes a customer id**.
It comes from the session cookie, so there is no parameter to change in order to
reach somebody else's records. A record id that belongs to another customer
answers 404 rather than 403 — a 403 would confirm it exists.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/me/requirements` | `LeadView[]` |
| GET | `/me/requirements/:id` | `LeadView` |
| POST | `/me/requirements` | `LeadView` |
| POST | `/me/requirements/:id/agreements` | `AgreementView[]` — groups chosen vendors into contracts |
| GET | `/me/services/:id/messages` | `Message[]` — the client thread only |
| POST | `/me/services/:id/messages` | `Message` |
| POST | `/me/services/:id/select-quote` | `LeadView` |
| GET | `/me/agreements` | `AgreementView[]` |
| POST | `/me/agreements/:id/sign` | `Agreement` |
| GET | `/me/projects` | `ProjectView[]` |
| POST | `/me/reviews` | `Review` |
| POST | `/me/visits/:id/reschedule` | `Meeting` |
| GET | `/me/notifications` | `Notification[]` |
| POST | `/me/notifications/read` | `{ count }` |
| GET | `/me/tickets` | `SupportTicket[]` |
| POST | `/me/tickets` | `SupportTicket` |
| POST | `/me/tickets/:id/replies` | `TicketReply` |
| GET | `/me/referrals` | `ReferralSummary` |

**The message endpoints never return `platform_vendor` messages.** That is
enforced twice: the query filters on channel, and the table has a check
constraint making a client-channel row with a vendor id impossible to write. Two
layers, because the vendor thread is where prices and margins are discussed.

**`POST /me/agreements/:id/sign` is the largest transaction in the system.** It
activates the contract, moves every covered service into execution, creates one
project per service with its four stages, and raises a single commission
invoice — five tables, all or nothing. The agreement row is locked for the
duration, so two taps on a slow connection cannot produce two sets of projects.
Commission is frozen at that moment from the vendor's rate for that trade; a
later override must not reprice work already agreed.

**Uploads happen before sign-in, on purpose.** The public requirement form lets
a visitor attach photographs before it asks them to verify a number — asking for
an account first is how a form loses the people who opened it. So
`POST /uploads/tickets` accepts an anonymous caller, but only for
`requirement_photo`, and rate-limits it by address. The assets are bound to the
requirement when it is submitted, which is also when the account is created.

---

## Vendor — built

Scoped to the signed-in professional. As with `/me`, no path takes a
professional id.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/vendor/leads` | `VendorLeadCard[]` — filter: `new`/`quoting`/`won`/`lost` |
| GET | `/vendor/leads/:id` | `VendorLeadCard` |
| POST | `/vendor/leads/:id/respond` | accept or decline |
| POST | `/vendor/leads/:id/quotes` | `Quote` |
| GET | `/vendor/leads/:id/messages` | `Message[]` — their thread with us only |
| POST | `/vendor/leads/:id/messages` | `Message` |
| GET | `/vendor/dashboard` | `VendorDashboard` |
| GET | `/vendor/agreements` | `VendorAgreementView[]` |
| GET | `/vendor/projects` | `VendorProjectView[]` |
| POST | `/vendor/projects/:id/stages/:stageId/proof` | `{ note, proof: string[] }` — asset ids from `/uploads/tickets`, not bytes |
| GET | `/vendor/invoices` | `VendorInvoiceView[]` |
| GET | `/vendor/visits` | `VendorVisitView[]` |
| GET | `/vendor/portfolio` | `PortfolioItem[]` |
| GET | `/vendor/performance` | `VendorPerformance` |
| GET | `/vendor/onboarding` | `VendorOnboarding` |
| POST | `/vendor/onboarding/agreement` | `PartnerAgreement` |

### Three rules the backend owns

**Contact masking.** No vendor-facing response contains a customer's phone
number or email. The rule is structural rather than procedural:
`MaskedClientSummary` has no field for either, and no query in the vendor module
selects `users.mobile`. A leak would have to be a deliberate change to the type.

The address is released only where the database says a visit for *that service*
is confirmed — computed in SQL beside the query, not in a mapper that could
drift. The same customer can therefore be sealed on one service and released on
another, which is correct: a vendor booked for the painting has no business
seeing the address because somebody else's furniture visit was confirmed.

**Signing gates assignment.** A professional with no signed current-version
partner agreement appears in no vendor pool, however verified their account or
approved their trades. `canReceiveLeads` and the pool filter both read the
`eligible_vendors` view, so they cannot disagree.

**Submitting evidence is not finishing.** `POST .../proof` marks a stage
*submitted*. Only an approval from ops moves the completion the customer sees.
The vendor-facing endpoint that used to write `completionPercent` directly has
been removed along with its dead UI — it let somebody declare themselves done.

---

## Authentication

| Method | Path | Response |
| --- | --- | --- |
| POST | `/auth/otp/request` | `{ challengeId, expiresInSeconds }` — body `{ mobile }` |
| POST | `/auth/otp/verify` | `Actor`, and sets the session cookie — body `{ challengeId, code, name?, cityId? }` |
| POST | `/auth/staff/login` | `Actor`, and sets the session cookie — body `{ email, password, totp? }` |
| POST | `/auth/logout` | `{ ok }` — revokes the session |
| GET | `/me` | `SessionUser` — `{ actor, name, mobile, avatarUrl }`, or 401 |

Codes are six digits, valid five minutes, three attempts, and stored as an
argon2 hash — a six-digit code is only a million possibilities, so a leaked
backup with codes in it would be a working login for every number that signed in
that hour. Requesting a new code consumes any earlier one.

Rate limits live in Postgres, not memory: an in-process counter gives an
attacker one allowance per instance and resets on every deploy. Five requests
per mobile per hour, twenty per IP; staff lock out for fifteen minutes after
five failures, and the lockout holds even against the correct password.

An unrecognised mobile creates a customer account — signing up and signing in
are the same action. Staff are refused on this path entirely and told to use a
password; a vendor account is created by ops, so somebody who is not yet a
vendor simply signs in as a customer.

---

## Uploads

| Method | Path | Response |
| --- | --- | --- |
| POST | `/uploads/tickets` | `UploadTicket` — body `{ purpose, fileName, contentType, sizeBytes }` |

`UploadTicket` is `{ uploadUrl, headers, assetId, publicUrl }`. The browser PUTs
the file straight at `uploadUrl` and then submits `assetId` with the form, so
photographs never pass through the application server — a vendor uploading eight
site photos on mobile data would otherwise hold a request open for minutes.

`purpose` is one of `requirement_photo`, `milestone_proof`, `portfolio_item`,
`vendor_document`, and decides where the file is stored and who may read it back.
The frontend enforces size and type limits before requesting a ticket
(`packages/data/src/uploads.ts`); **the backend must enforce them again** — those
checks are a courtesy to the user, not a control.

---

## Staff

Requires a `sales_agent` or `admin` session. These see customer contact details.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/ops/leads` | `OpsLeadRow[]` — filters: status, domain, city, urgency, agent, search |
| GET | `/ops/leads/:id` | `OpsLeadRow` |
| GET | `/ops/leads/:id/timeline` | `TimelineEvent[]` |
| GET | `/ops/leads/:id/projects` | `LeadProjectView[]` |
| GET | `/ops/leads/:leadDomainId/relay` | `RelayView` — both sides |
| POST | `/ops/leads/:leadDomainId/relay/client` | reply to the customer |
| POST | `/ops/leads/:leadDomainId/relay/vendors` | one message to every assigned vendor |
| GET | `/ops/leads/:leadDomainId/pool` | `VendorPoolEntry[]` |
| POST | `/ops/leads/:leadDomainId/assign` | body `{ professionalIds }` |
| POST | `/ops/leads/:id/calls` | `LeadSalesActivity` |
| POST | `/ops/visits` | `Meeting` |
| POST | `/ops/visits/:id/outcome` | `Meeting` |
| POST | `/ops/projects/:id/stages/:stageId/review` | approve or send back |
| GET | `/ops/my-day` | `MyDayView` |
| GET | `/ops/dashboard` | `AdminDashboard` |
| GET | `/ops/vendors` | `VendorRow[]` |
| PATCH | `/ops/vendors/:id` | verification status |
| PATCH | `/ops/vendors/:id/domains/:domainId` | trade approval, commission override |
| GET | `/ops/agreements` | `AgreementView[]` |
| GET | `/ops/invoices` | `InvoiceRow[]` |
| PATCH | `/ops/invoices/:id` | mark paid, waive with reason |
| GET/POST/PATCH | `/ops/domains` | domain configuration |
| GET | `/ops/tickets`, POST replies, PATCH status | support |

---

## Business logic that belongs to the backend

These currently live in `packages/data` because there was nowhere else to put
them. They write financial and derived state and must **move** server-side —
not be reimplemented as HTTP calls from the browser.

| Operation | What it does | Why it cannot stay client-side |
| --- | --- | --- |
| `signAgreement` | Creates one project per covered service, generates stages, locks in the commission rate, raises one invoice | Writes money. Must be one transaction |
| `generateAgreements` | Groups selected vendors by professional: same professional across services collapses into one combined contract | The rule the commercial model rests on |
| `submitQuote` | Versions the quote, supersedes the previous, moves lead-domain status | Ordering and versioning must be serialised |
| `assignProfessionals` | Writes assignments, notifies both sides, records an unmet vendor preference | Authorisation-sensitive |
| `reviewMilestoneProof` | Approves a stage, recomputes completion, closes the project at 100% | Determines what the customer is shown as done |
| `submitReview` | Writes the review and recalculates per-domain and overall ratings | Ratings must not be client-writable |
| `signPartnerAgreement` | Records signature, clauses, timestamp; unlocks lead assignment | Legal record. The IP and user-agent it stores are placeholders — those must be captured server-side |
| `recomputeLeadStatus` | Derives lead status from its lead-domains | Single source of truth |

`recomputeLeadStatus` is the clearest example: `leads.overallStatus` is
**derived**, never set directly. If two services complete concurrently and both
recompute client-side, the answers race.

---

## Migration order

The seam is per function, so this can be done incrementally with the app working
throughout:

1. **Read-only public data** — domains, catalogue, blog, directory, search.
   **Already wired.** Set `NEXT_PUBLIC_API_URL`, implement these endpoints, and
   they switch over with no frontend change. Do this first: it proves the
   plumbing against the least dangerous data.
2. **Authentication** — fill in the `configureSession` callback in each app's
   `instrumentation.ts`. The call sites are already correct, because no function
   takes a caller id.
3. **Customer reads**, then customer mutations.
4. **Vendor and staff surfaces**, which carry the masking and gating rules.
5. **Uploads** — implement `/uploads/tickets`. `uploadFile()` already does
   validation, the ticket request and the PUT.

Sections 3–5 still resolve against the seed store. Wiring one is mechanical:
wrap the body in `readThrough(path, options, mock)` — or, where the query needs
mapping, an explicit `if (USING_API) return api(...)`. Both live in
`packages/data/src/client.ts`, alongside `fromApiOrMock()` for the same job in
expression form.
