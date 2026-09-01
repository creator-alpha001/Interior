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

**Authentication** — session cookie forwarded by the frontend. The backend
derives the caller from it. Endpoints below never take a `clientId` or
`professionalId` for *the caller* — only for records being addressed. This
matters: `GET /me/requirements` must return the signed-in customer's leads, not
whichever id the client asked for.

**Errors** — JSON body `{ code, message, details? }` with a meaningful status.
`packages/data/src/client.ts` maps these to `ApiError`, which the UI uses to
distinguish "not signed in" from "not found" from "server broke".

**Money** — whole rupees, integers. No paise anywhere.

**Dates** — ISO-8601 timestamps; `YYYY-MM-DD` where only a date matters.

---

## Public catalogue

| Method | Path | Response | Notes |
| --- | --- | --- | --- |
| GET | `/domains` | `Domain[]` | Active trades, sorted |
| GET | `/domains/:slug` | `Domain` | |
| GET | `/cities` | `City[]` | |
| GET | `/products` | `ProductView[]` | Filters: `domain`, `category`, `search`, `city`, `tags`, `maxPrice`, `sort`, `limit`, `cursor` |
| GET | `/products/:slug` | `ProductView` | `city` affects `effectivePrice` |
| GET | `/products/:slug/related` | `ProductView[]` | |
| GET | `/categories` | `ProductCategory[]` | Filter: `domain` |
| GET | `/packages` | `PackageView[]` | Filter: `domain` |
| GET | `/packages/:slug` | `PackageView` | |
| GET | `/professionals` | `ProfessionalSummary[]` | Filters: `domain`, `city`, `search`, `verifiedOnly` |
| GET | `/professionals/:id` | `ProfessionalProfile` | |
| GET | `/portfolio` | `PortfolioItem[]` | Filter: `domain`. Approved items only |
| GET | `/posts` | `BlogPostView[]` | Filters: `category`, `tag`, `domain`, `search` |
| GET | `/posts/:slug` | `BlogPostView` | |
| GET | `/search` | `SearchResults` | `q`, `city` |
| GET | `/search/suggest` | `{ label, hint, href }[]` | Type-ahead; keep it fast |
| GET | `/banners`, `/testimonials`, `/stats` | | Home page content |

**Pagination is not implemented in the frontend yet.** `listProducts()` returns
everything. Design these endpoints with `cursor` and `limit` from the start —
adding them later means touching every call site.

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
| POST | `/vendor/projects/:id/stages/:stageId/proof` | multipart: photos + note |
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
| `signPartnerAgreement` | Records signature, clauses, timestamp; unlocks lead assignment | Legal record |
| `recomputeLeadStatus` | Derives lead status from its lead-domains | Single source of truth |

`recomputeLeadStatus` is the clearest example: `leads.overallStatus` is
**derived**, never set directly. If two services complete concurrently and both
recompute client-side, the answers race.

---

## Migration order

The seam is per function, so this can be done incrementally with the app working
throughout:

1. **Read-only public data first** — domains, catalogue, blog. Lowest risk, and
   proves the plumbing.
2. **Authentication**, replacing `DEMO_ACTORS` in `packages/data/src/session.ts`
   with a real session read. Data functions then stop taking a caller id.
3. **Customer reads**, then customer mutations.
4. **Vendor and staff surfaces**, which carry the masking and gating rules.
5. **File uploads** — stage proof and requirement photos currently use
   `URL.createObjectURL` and never leave the browser. They need presigned URLs,
   progress and failure states.

Use `fromApiOrMock()` from `packages/data/src/client.ts` to move one function at
a time.
