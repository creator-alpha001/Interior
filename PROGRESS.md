# Progress — 9 September 2026

Three streams of work: the backend was prepared for hosting on Hostinger with
Supabase Postgres, the product was renamed from Aangan to InterioBee across both
repositories, and Cloudflare R2 was configured and verified as the storage
driver.

The database is live and working. The API has not been deployed yet.

---

## 1. Database — Supabase, live

A Supabase project (`rwelnbbttmqbygmarwoz`, Mumbai / `ap-south-1`) now holds the
schema, and everything below was verified against it rather than assumed.

| Check | Result |
| --- | --- |
| Migrations applied | 10 of 10 |
| Public tables | 51 |
| Tables with RLS / policies | 32 / 34 |
| `aangan_app` | login, **not** superuser, **not** bypassrls |
| `aangan_ops` | login, bypassrls — as designed |
| `pgboss` schema | exists, owned by `aangan_app` |
| Seed | 6 cities, 4 domains, 59 products, 6 leads, 4 projects |

**Row-level security was proved, not assumed.** Connected as the application
role through the session pooler, with a real customer's identity set the way
`openScope` sets it per request:

```
no actor set          -> 6 leads visible
as customer A         -> 3 leads visible (A owns 3)
A querying B's leads  -> 0 rows (B actually owns 1)
```

The staff role's query plans show no policy filter, confirming the two-role
split does what migrations 0005 and 0007 intended.

### The connection choice that mattered

Supabase offers three connection strings and two of them break this application:

- **Direct** (`db.<ref>.supabase.co`) is IPv6-only; Hostinger's runtime is IPv4.
- **Transaction pooler** (`:6543`) returns the connection to the pool after every
  transaction. This app reserves a connection per personal request and sets
  `app.user_id` on it, which is what the RLS policies read. Through a
  transaction pooler that setting is gone by the next query — and the policies
  deliberately treat *no actor* as *no restriction*, so they do not fail closed.
  **They stop applying, silently.** pg-boss cannot run on one either.
- **Session pooler** (`:5432`) is the correct one, and is what is configured.

The server now refuses to start on port 6543 in production, and refuses to start
without `sslmode` on a remote URL, rather than let either fail quietly.

---

## 2. Storage — Cloudflare R2, verified

Bucket `interiobee`, Asia-Pacific, Standard class. Verified end to end through
the application's own storage code:

```
driver       : r2 (interiobee)
upload       : 200 OK          (presigned PUT, SigV4)
public fetch : 200 OK, content matches
after delete : 404 OK, object gone
delete twice : OK, idempotent
```

Reads are unsigned — `${R2_PUBLIC_BASE_URL}/${key}` — so the bucket is public,
and object keys are `${purpose}/${randomUUID()}`. That is capability-URL
security: unguessable, but anyone holding a URL can read that file indefinitely.
Worth revisiting for `vendor_document`.

---

## 3. Rebrand — Aangan to InterioBee

**Web and API** — page titles and metadata, header and footer wordmarks, the ops
shell, partner terms, referral copy, support author names, the mobile upgrade
prompt, the OpenAPI title, `README.md`. Referral codes now derive from
`INTERIOBEE`; share URLs moved to `interiobee.example.com`.

**Mobile** (`D:\Interior-mobile`, 125 files, a symmetric 696/696 diff):

- Dart packages `aangan_*` → `interiobee_*`, all nine, including the seven
  barrel files renamed on disk so imports resolve
- Class names `AanganCard`, `AanganTheme`, `AanganPalette`, `AanganApi` →
  `InterioBee*`
- Build defines `AANGAN_API_URL` / `_ENV` / `_BUILD` → `INTERIOBEE_*`
- App id unified to `com.interiobee.app` — Android and iOS previously disagreed
  (`aangan_app` vs `aanganApp`) — and the Kotlin sources moved to match
- Display name is `InterioBee`; Android and iOS were showing the scaffold
  default `aangan_app`

**Deliberately left alone:** the `aangan_app` / `aangan_ops` Postgres roles, the
local database and Docker names, and the `aangan_session` cookie. The roles are
written into the RLS policies, so renaming them means a migration and a re-run of
the Supabase bootstrap. None of it is user-visible. This is a decision, not an
oversight.

---

## 4. Bugs found and fixed

Each of these was found by verifying something rather than by reading it.

**Empty environment variables crashed the boot.** `SENTRY_DSN=` — a blank line
in the template, meant to be left alone — failed validation with
`SENTRY_DSN: Invalid url`, because Zod's `.optional()` admits `undefined`, not
`""`. The first Hostinger deploy would have refused to start on a variable
nobody set. Empty values are now stripped before parsing. This also covers
hosting panels, which leave an empty string when a field is cleared.

**`deleteObject` did nothing on R2.** It returned early for any driver that was
not `local` — no request, no error, no log line. Nothing calls it yet, which is
the only reason it had not cost anything, but the first caller would have been a
feature deleting a customer's photograph: it would have reported success while
the file stayed publicly readable for ever. The SigV4 signer is now shared
between PUT and DELETE, deletes are idempotent, and placeholder keys are skipped.

**The seed could install a published password on production.** It guarded on
`NODE_ENV === "production"`, which describes the *process*, not the database it
writes to. On a laptop that is always `development`, so seeding a managed
database walks straight past it and installs `aangan-dev-password` — a literal in
this public repository — on three accounts that can read every customer's phone
number. That is what happened here. The check is now *where the rows land*: any
non-local host without `SEED_STAFF_PASSWORD` is refused, before the `TRUNCATE`
rather than inside the transaction. The seed also no longer echoes an
operator-supplied password to stdout.

**Migration 0005 could abort on managed Postgres.** Its
`GRANT CREATE ON DATABASE` needs database ownership, which Supabase's `postgres`
does not have. It now degrades to a `NOTICE`. In the event the grant succeeded
here, so the guard was not load-bearing — but it is correct for providers where
it is not.

**`.gitignore` did not cover `.env.production`.** The obvious filename for the
Supabase and R2 credentials was matched by none of the three env patterns, in a
repository whose own comments note that it is public. Now `.env.*` is ignored
with the two `*.example` templates allowed back, plus `*.local.sql`.

**Pool sizes were hardcoded for Railway.** 10 and 6, chosen against a
hundred-connection limit; a Supabase session pooler allows about 15 for the
whole project. Now `DATABASE_POOL_MAX` / `OPS_DATABASE_POOL_MAX`, set to 8 and 4.

---

## 5. Files added

| File | Purpose |
| --- | --- |
| `HOSTING.md` | The deployment runbook — Supabase, migrations, Hostinger settings, and what fails silently |
| `apps/api/.env.production.example` | Annotated production environment template |
| `apps/api/supabase/bootstrap.sql` | Role logins, the `pgboss` schema, and an assertion that the app role cannot bypass RLS |
| `apps/api/build.mjs` | esbuild bundle producing `dist/server.js` (was already present, uncommitted) |

`DEPLOYMENT.md` no longer claims there is no backend to provision.

---

## 6. Verified today

- `typecheck` clean across all five workspaces
- `openapi:check` up to date; 46 schema tests pass
- API bundle builds
- Mobile: `flutter pub get`, `flutter analyze` (no issues), all seven package
  test suites pass, and a debug APK builds with merged manifest
  `package="com.interiobee.app"`, `android:label="InterioBee"`
- Mobile's pinned `contract/openapi.json` re-synced and matching

## Not verified

- **The API test suite has never run** — it needs Postgres on `:55432` and
  Docker is not on PATH on this machine
- **Nothing has been deployed to Hostinger.** The build command, entry file and
  Node version in `HOSTING.md` are reasoned from their documentation, not
  confirmed against a real deploy
- **Hostinger's idle behaviour is undocumented.** If it sleeps or restarts the
  app, pg-boss cron work silently stops
- **iOS was never built** — the identifiers are edited, but that needs a Mac
- **The mobile app has not run against the live API**

---

## 7. What is outstanding

**Blocking the deploy**

1. `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` — without them nobody can sign in,
   since OTP is the only customer and vendor login path. The server boots and
   warns rather than failing.
2. `WEB_ORIGIN`, `ADMIN_ORIGIN`, `PUBLIC_BASE_URL` are still `example.com`.
   The domain `interiobee.com` is owned, at Namecheap; DNS needs moving to
   Cloudflare before the R2 custom domain can be attached.

**Security**

3. **Reset the `postgres` password in Supabase.** It was exposed in the working
   session and nothing has invalidated it. The role passwords were rotated and
   the exposed pair was never active.
4. Demo data is live in the production database — `LD-1042`, fake customers,
   three `@example.com` staff accounts. Acceptable now; clear it before real
   customers arrive.

**Should be done before launch**

5. **R2 custom domain** (`media.interiobee.com`). The `pub-….r2.dev` URL is
   rate-limited and not for production, and these URLs get written into
   `media_assets` rows — changing it later means rewriting them.
6. **`sweepOrphanMedia` never deletes files.** It removes the database rows and
   leaves the R2 objects for ever, so abandoned uploads accumulate against the
   10 GB free tier with nothing to reclaim them. Now a small change, since
   `deleteObject` works — but it makes a scheduled job start deleting real
   files, so it wants a deliberate decision.
7. **There is no CORS plugin.** Fine while the frontends call the API
   server-to-server; any browser calling it cross-origin fails on preflight.
8. **Migrations do not run themselves.** No release phase on Hostinger, so every
   deploy carrying a schema change needs `db:migrate` run by hand first.
9. `NEXT_PUBLIC_API_URL` is not set on the Vercel projects, so the web and admin
   apps still run entirely on seed data.
10. No logo or icon assets were changed — the rebrand was text only.

**Housekeeping**

11. Nothing is committed: 44 changed files here, 130 in `D:\Interior-mobile`.
    Two repositories, two commits.
