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

**The public read section below is built and running.** `apps/api` serves it
against PostgreSQL; set the base URL and the catalogue, blog, directory and
search stop reading seed data. Everything further down is still the contract to
build.

**Authentication** — session cookie forwarded by the frontend. The backend
derives the caller from it. Endpoints below never take a `clientId` or
`professionalId` for *the caller* — only for records being addressed. This
matters: `GET /me/requirements` must return the signed-in customer's leads, not
whichever id the client asked for.

The frontend already holds up its half of that: no data function accepts the
caller's own id. They ask `packages/data/src/session.ts`, which each app wires
up in its `instrumentation.ts`. Connecting real auth means replacing one
function body there — the `configureSession` callback — and nothing else.

Until that callback returns a real actor, the data layer falls back to a seeded
demo identity per role. **That fallback switches itself off once
`NEXT_PUBLIC_API_URL` is set**: with a backend present, no session means
`NotAuthenticatedError`, never somebody else's rows.

There is one bounded exception, for the migration window only. The surfaces move
to the API one at a time, so the catalogue can be live on Postgres while the
account pages are still on seed data — and without an escape hatch, turning the
API on would break every signed-in screen until authentication lands. Setting
`NEXT_PUBLIC_ALLOW_DEMO_SESSION=true` keeps the demo identities working in that
state. It is ignored in a production build, so it cannot become the way the
system runs.

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

## Customer

All scoped to the signed-in customer.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/me/requirements` | `LeadView[]` |
| GET | `/me/requirements/:id` | `LeadView` |
| POST | `/me/requirements` | `LeadView` — body is `RequirementInput` |
| GET | `/me/agreements` | `AgreementView[]` |
| POST | `/me/agreements/:id/sign` | `Agreement` |
| GET | `/me/projects` | `ProjectView[]` |
| POST | `/me/projects/:id/review` | `Review` |
| GET | `/me/notifications` | `Notification[]` |
| POST | `/me/notifications/read` | `{ count }` |
| GET | `/me/referrals` | `ReferralSummary` |
| GET | `/me/tickets` | `SupportTicket[]` |
| POST | `/me/tickets` | `SupportTicket` |
| POST | `/me/tickets/:id/replies` | `TicketReply` |
| GET | `/me/requirements/:leadDomainId/messages` | `Message[]` — client thread only |
| POST | `/me/requirements/:leadDomainId/messages` | `Message` |
| POST | `/me/quotes/:id/select` | `LeadView` |
| POST | `/me/visits/:id/reschedule` | `Meeting` |

**The message endpoints must never return `platform_vendor` messages.** The
customer's thread is with the platform. Enforce that server-side; do not rely on
the frontend filtering.

---

## Vendor

Scoped to the signed-in professional.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/vendor/leads` | `VendorLeadCard[]` — filter: `new`/`quoting`/`won`/`lost` |
| GET | `/vendor/leads/:leadDomainId` | `VendorLeadCard` |
| POST | `/vendor/leads/:leadDomainId/respond` | accept or decline |
| POST | `/vendor/leads/:leadDomainId/quotes` | `Quote` — body is `QuoteDraftInput` |
| GET | `/vendor/leads/:leadDomainId/messages` | `Message[]` — their thread with us only |
| POST | `/vendor/leads/:leadDomainId/messages` | `Message` |
| GET | `/vendor/dashboard` | `VendorDashboard` |
| GET | `/vendor/agreements` | `VendorAgreementView[]` |
| GET | `/vendor/projects` | `VendorProjectView[]` |
| GET | `/vendor/projects/:id` | `VendorProjectView` |
| POST | `/vendor/projects/:id/stages/:stageId/proof` | `{ note, proof: MediaAsset[] }` — ids from `/uploads/tickets`, not bytes |
| GET | `/vendor/invoices` | commission invoices |
| GET | `/vendor/onboarding` | `VendorOnboarding` |
| POST | `/vendor/onboarding/agreement` | `PartnerAgreement` |
| GET | `/vendor/performance` | `VendorPerformance` |

### Two rules the backend owns

**Contact masking.** No vendor-facing response may contain a customer's phone
number or email — ever, under any query. The address is released only once a
visit for that lead-domain is confirmed. See `MaskedClientSummary`: that shape
is the whole permitted surface.

**Signing gates assignment.** A professional with no signed current-version
partner agreement must not appear in any vendor pool, however verified their
account or approved their trades.

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
