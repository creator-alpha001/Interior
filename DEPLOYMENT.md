# Deploying the previews

Two apps, two Vercel projects, one repository. Everything runs on seed data
— there is no backend or database to provision.

**Setup happens three times. Deployment happens once.** Creating the projects is
a one-off: a Vercel project maps to exactly one app and one URL, so there are
three of them. After that, a single `git push` rebuilds both.

The previews are **password-protected and non-indexable**. This is unreleased
work sitting on sample data; nobody should reach it by stumbling across a URL.

---

## One-time setup

### 1. Create two Vercel projects

Import this repository twice. Only two fields differ each time:

| Project name | Root Directory |
| --- | --- |
| `interior-web` | `apps/web` — customer site and `/partner` portal |
| `interior-admin` | `apps/admin` |

Vercel detects Next.js automatically. One setting matters:

**"Include files outside the Root Directory"** must stay **on** — it is behind
the *Edit* button next to Root Directory. Every app imports `@repo/ui`,
`@repo/data`, `@repo/types` and `@repo/mock` from `packages/` at the repository
root. Without this the build fails with "module not found" on all four. It is
the most common way a monorepo import fails on the first attempt.

Leave Vercel's Git integration **connected**. That is what makes one push deploy
everything.

### 2. Set environment variables on each project

Add these **before the first deploy**, in the Environment Variables section of
the import screen:

| Variable | Value |
| --- | --- |
| `PREVIEW_USER` | a shared username, e.g. `team` |
| `PREVIEW_PASSWORD` | a shared password — use the same one on both |
| `NEXT_PUBLIC_DEPLOY_ENV` | `preview` |

`PREVIEW_PASSWORD` is what turns the access gate on. Without it, the first
deployment is publicly reachable — including an ops panel showing commission
figures and customer phone numbers.

`NEXT_PUBLIC_*` variables are **baked in at build time**, so adding
`NEXT_PUBLIC_DEPLOY_ENV` afterwards means rebuilding. Anything other than
`production` keeps `robots.txt` disallowing everything and the sitemap empty.

Later, when a backend exists, `NEXT_PUBLIC_API_URL` goes here too. Until it is
set, the apps run entirely on seed data.

---

## Deploying, from then on

```bash
git push origin main
```

All three projects watch this repository. Vercel rebuilds whichever apps a
commit affects, and both when something in `packages/` changes — which is
correct, since they share it.

Nothing else to run. No secrets, no workflow to trigger.

---

## The workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | pull requests and pushes to `main` | Builds both apps and lints. A type error in a shared package breaks every app, so both are built rather than only the one that changed. |
| `deploy.yml` | **manual only** | A fallback that deploys both through the Vercel CLI. Not needed while the Git integration is connected. |

`deploy.yml` is deliberately not on `push`: with Vercel's Git integration
connected it would deploy everything a second time. Use it from *Actions → Deploy
previews → Run workflow* if you ever disconnect that integration, or want to
deploy without pushing. It needs these repository secrets, which are otherwise
unnecessary: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`,
`VERCEL_PROJECT_ID_ADMIN`, `VERCEL_PROJECT_ID_VENDOR`.

---

## How the access gate works

Each app has `src/proxy.ts` — Next 16's replacement for the deprecated
`middleware` convention — doing HTTP basic auth against `PREVIEW_USER` and
`PREVIEW_PASSWORD`, read per request. Static assets are excluded so pages stay
fast once authenticated.

With `PREVIEW_PASSWORD` unset the gate is a no-op, so local development is
unaffected.

This is a preview gate, not authentication. It puts unreleased work behind a
shared password; it is not a substitute for the per-user auth that has to be
built alongside the backend.

---

## Sharing the previews

Send both links together — the platform only makes sense seen from every
side:

- **Customer site** — browse the catalogue, submit a requirement, compare quotes
- **Ops panel** — the same lead from the inside: the relay console, assignment,
  stage approval
- **Vendor panel** — the third view: a masked customer, the quote builder, stage
  evidence

The most convincing walkthrough is one lead seen from both: `LD-1042` in
ops, the same job in the vendor panel, and the customer's own view of it.

Two things worth saying out loud before a walkthrough:

- Each app is signed in as a fixed demo identity (`src/lib/session.ts`). Everyone
  shares that identity **and the same in-memory data**, so changes one reviewer
  makes are visible to the next until the server restarts.
- All imagery is designed placeholder tiles, not photographs of real work.
