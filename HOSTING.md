# Hosting the API — Hostinger Business, Supabase Postgres

The API on Hostinger's managed Node.js runtime, the database on Supabase. This
is the backend only. The two Next.js frontends stay on Vercel; see
[DEPLOYMENT.md](DEPLOYMENT.md) for those.

Read [What will bite you](#what-will-bite-you) before the first deploy rather
than after. Three of the five items there fail silently.

---

## The shape of it

| Piece | Where | How it gets there |
| --- | --- | --- |
| Fastify API | Hostinger Business, Node.js app | GitHub push, built by Hostinger |
| Postgres | Supabase, session-mode pooler | — |
| Migrations | run from your laptop, as the owner | `npm run db:migrate` |
| Scheduled jobs | inside the API process (pg-boss) | `RUN_JOBS=true` |
| Uploads | Cloudflare R2 | `STORAGE_DRIVER=auto` |

Hostinger's Business plan does support long-running Node apps — 18.x through
24.x, deployed from a repository. It is a managed runtime, not a VPS: no root,
no shell, and **no release phase**, which is why migrations are run by hand
below rather than on deploy.

---

## 1. Supabase

Create the project. Pick the region closest to your users — `ap-south-1`
(Mumbai) for an Indian customer base — because every query pays the round trip
and this app makes several per request.

Then, from *Connect*, take the **Session pooler** string. Supabase offers three
and the wrong two both look right:

| | Host | Use it? |
| --- | --- | --- |
| Direct | `db.<ref>.supabase.co:5432` | **No.** IPv6 only; Hostinger's runtime is IPv4 and cannot resolve it. |
| Transaction | `...pooler.supabase.com:6543` | **No.** See below. |
| Session | `...pooler.supabase.com:5432` | **Yes.** |

Transaction mode returns the connection to the pool after every transaction.
This app reserves one connection per customer or vendor request and sets
`app.user_id` on it; the row-level security policies read that setting. Through
a transaction pooler the setting is gone by the next query — and the policies in
migrations 0005 and 0007 deliberately treat *no actor* as *no restriction*, so
they do not fail closed. They stop applying. Nothing errors and nothing is
logged. pg-boss cannot run on one either, so the scheduled jobs would stop too.

The server refuses to start on port 6543 when `NODE_ENV=production`, rather than
let that happen quietly.

Every URL also needs `?sslmode=require`. Both drivers in use — postgres.js for
the app, `pg` inside pg-boss — default to an **unencrypted** connection, and
this one crosses the public internet. The server refuses to start without it in
production.

---

## 2. Migrate, from your laptop

There is no release phase on Hostinger, so this is a manual step you run before
each deploy that carries a schema change.

Migrations run as the **owner** (`postgres`), because they create tables. The
API deliberately cannot.

```bash
OWNER_DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require" npm run db:migrate
```

Watch for a `NOTICE` about `GRANT CREATE ON DATABASE` during migration 0005.
That is expected on Supabase — `postgres` does not own the database there, so it
cannot grant that — and the next step covers what it was for.

## 3. Bootstrap the roles

Migrations create `aangan_app` and `aangan_ops` without a login, because a
password does not belong in a committed file. Finish them off once:

```bash
psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/supabase/bootstrap.sql
```

Edit the two passwords in it first, or paste it into Supabase's SQL editor,
which already runs as `postgres`. It also creates the `pgboss` schema owned by
`aangan_app`, which is what replaces the grant that could not be made, and
asserts that `aangan_app` cannot bypass row-level security.

**`aangan_app` is not `postgres`.** The whole point of that role is that it
cannot bypass row-level security. Pointing `DATABASE_URL` at `postgres` because
it is convenient turns migrations 0005 and 0007 into decoration.

## 4. Reference data

A fresh database has no cities, domains or product categories, so the API
answers empty on every catalogue route.

`npm run db:seed` fills them in — but read this first: **the seed `TRUNCATE`s
every table**, including users, leads and agreements. It is a "reset my
development database to the demo" tool. On an empty database before launch it is
fine and is the quickest way to a working system. Once there is one real
customer in there it is a data-loss event with no undo.

It also loads the demo: `LD-1042` and its supporting cast. If this database is
going to hold real customers, decide deliberately whether you want that, and
insert the reference tables by hand if not.

---

## 5. The Hostinger app

*Websites → Add website → Node.js app*, deployed from this GitHub repository.

| Setting | Value |
| --- | --- |
| Node.js version | **22.x** — the build targets Node 22 |
| Build command | `npm ci && npm run build:api` |
| Entry file | `apps/api/dist/server.js` |
| Output directory | leave empty |

The build command matters. The repository root's `npm run build` builds the two
**Next.js frontends**, not this — it is what Vercel runs. `build:api` bundles the
server with esbuild into `apps/api/dist/server.js`, compiling in the `@repo/*`
workspace packages, which are raw TypeScript and cannot be resolved at runtime.
Real dependencies stay external and come from `npm ci` at the root.

`npm start` at the root also starts the API, if Hostinger prefers that to an
entry file.

### Environment variables

Copy [`apps/api/.env.production.example`](apps/api/.env.production.example) —
it is annotated per variable. The ones with no safe default:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | `aangan_app`, session pooler, `?sslmode=require` |
| `OPS_DATABASE_URL` | `aangan_ops`, same host |
| `SESSION_SECRET` | 32+ bytes; `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NODE_ENV` | `production` — several safety checks key off this |
| `WEB_ORIGIN`, `ADMIN_ORIGIN` | the real frontend URLs |
| `PUBLIC_BASE_URL` | this API's public URL; mobile builds upload URLs on it |
| `R2_*` | see below — the server will not start without them |
| `DATABASE_POOL_MAX` | `5`. Supabase allows far fewer connections than Railway did |
| `OPS_DATABASE_POOL_MAX` | `2` |
| `DATABASE_POOLER_MAX_CLIENTS` | `15`, matching the pool size in the Supabase dashboard |
| `GOOGLE_CLIENT_IDS` | Comma-separated OAuth client ids, or empty to disable Google sign-in |

Do **not** set `OWNER_DATABASE_URL` here. The running API has no business
holding a credential that can drop tables; it lives in your local `.env` only.

## 6. Check it

```bash
curl https://<your-api>/health   # process is up
curl https://<your-api>/ready    # database is reachable
```

`/ready` returning 503 with everything else fine is almost always the connection
string: wrong port, missing `sslmode`, or a password that was never set by
`bootstrap.sql`.

Then read the startup log. Anything running on a fallback driver says so there
— that is where you find out SMS is going to the console instead of to phones.

---

## What will bite you

**Uploads on local disk vanish.** Hostinger replaces the application's disk on
every deploy. `STORAGE_DRIVER=local` there means customer photographs, stage
evidence and vendor documents are gone on the next push, with no error and
nothing to restore from. The server refuses to start in production with
`auto` and no R2 configured, specifically so this cannot happen by omission —
configure R2.

**Connection limits are much tighter than Railway's.** The session pooler
defaults to about 15 connections for the whole project, shared with your
migrations and any `psql` session. `DATABASE_POOL_MAX` + `OPS_DATABASE_POOL_MAX`
must stay under it with headroom — together with the job queue's own 2, which
is easy to forget and is what made 8 and 4 look safe when it totalled 14 of 15.
The server now refuses to start when the three exceed the budget, because the
alternative is finding out under concurrency: a Vercel build generating static
pages opened enough at once to fail `/sitemap.xml` and abort the deploy. And
because each customer or
vendor request reserves a connection for its whole life, `DATABASE_POOL_MAX` is
also the ceiling on concurrent personal requests — raise the pooler's size in
Supabase before raising it here.

**Migrations do not run themselves.** No release phase. A deploy carrying a
schema change needs step 2 run first, by hand, or the new code meets the old
schema.

**One process means one job runner.** `RUN_JOBS=true` keeps notifications going
out, invoices going overdue and expired codes swept. pg-boss coordinates through
Postgres, so this stays correct if you ever run more than one instance — but if
the app is idled or restarted by the platform, scheduled work does not run while
it is down. If notifications stop, check the process is actually up before
looking at the queue.

**There is no CORS plugin.** The frontends call this API server-to-server, which
needs none. The moment a browser calls it directly from another origin — a
mobile web view, a new client — those requests fail on preflight, and the fix is
`@fastify/cors`, not a change here.
