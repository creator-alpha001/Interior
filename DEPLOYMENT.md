# Deploying the previews

Three apps, three Vercel projects, deployed by GitHub Actions on every push to
`main`. Everything runs on seed data — there is no backend and no database to
provision.

The previews are **password-protected and non-indexable**. This is unreleased
work sitting on sample data; nobody should reach it by stumbling across the URL.

---

## One-time setup

### 1. Create three Vercel projects

In Vercel, import this repository three times. The only setting that differs is
the root directory:

| Project name | Root directory | Suggested domain |
| --- | --- | --- |
| `aangan-web` | `apps/web` | `preview.aangan.com` |
| `aangan-admin` | `apps/admin` | `ops-preview.aangan.com` |
| `aangan-vendor` | `apps/vendor` | `partners-preview.aangan.com` |

Vercel detects Next.js automatically. Two settings matter:

- **Include files outside the root directory** must stay **on** (it is the
  default). Each app imports the shared packages, so a build limited to
  `apps/web` alone would fail.
- **Turn off Vercel's own Git integration** for all three (Settings → Git →
  disconnect), so deployments happen through this workflow rather than twice on
  every push.

The workflow runs the Vercel CLI from the repository root and lets each
project's Root Directory setting select the app. Running it inside `apps/web`
would nest that path twice and fail.

### 2. Set environment variables on each project

Settings → Environment Variables, for Production:

| Variable | Value | Which apps |
| --- | --- | --- |
| `PREVIEW_USER` | a shared username, e.g. `team` | all three |
| `PREVIEW_PASSWORD` | a shared password | all three |
| `NEXT_PUBLIC_DEPLOY_ENV` | `preview` | all three |

`PREVIEW_PASSWORD` is what turns the gate on. Leave it unset locally and the
apps run open, which is what you want in development.

`NEXT_PUBLIC_DEPLOY_ENV` must stay anything other than `production` — that is
what keeps `robots.txt` disallowing everything and the sitemap empty. Set it to
`production` only on a real launch.

### 3. Add repository secrets

GitHub → Settings → Secrets and variables → Actions:

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel project → Settings → General |
| `VERCEL_PROJECT_ID_WEB` | the `aangan-web` project's Settings → General |
| `VERCEL_PROJECT_ID_ADMIN` | the `aangan-admin` project |
| `VERCEL_PROJECT_ID_VENDOR` | the `aangan-vendor` project |

### 4. Push

```bash
git push origin main
```

The **Deploy previews** workflow builds and deploys all three in parallel. Each
job prints its URL in the run summary.

To deploy without pushing, use *Actions → Deploy previews → Run workflow*.

---

## What the workflows do

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | pull requests and pushes to `main` | Builds all three apps and lints. A type error in a shared package breaks every app, so all three are built rather than only the one that changed. |
| `deploy.yml` | pushes to `main`, or manually | Builds and deploys each app to its own Vercel project. |

Both use a `concurrency` group, so a newer push cancels an in-flight run rather
than racing it.

---

## How the access gate works

Each app has `src/proxy.ts` — Next 16's replacement for the deprecated
`middleware` convention — doing HTTP basic auth against `PREVIEW_USER` and
`PREVIEW_PASSWORD`. Static assets are excluded so pages still load quickly once
authenticated.

When `PREVIEW_PASSWORD` is not set the gate is a no-op, so local development is
unaffected.

This is a preview gate, not authentication. It protects unreleased work behind a
shared password; it is not a substitute for the real per-user auth that has to
be built alongside the backend.

---

## Sharing the previews

Send all three links together — the platform only makes sense seen from all
sides:

- **Customer site** — browse the catalogue, submit a requirement, compare quotes
- **Ops panel** — the same lead from the inside: the relay console, assignment,
  stage approval
- **Vendor panel** — the third view: a masked customer, the quote builder, stage
  evidence

The most convincing sequence is one lead viewed from all three: `LD-1042` in
ops, the same job in the vendor panel, and the customer's own view of it.

Each app is signed in as a fixed demo identity (`src/lib/session.ts`). Every
visitor shares that identity and the same in-memory data, so **changes one
person makes are visible to everyone else** until the server restarts. Fine for
review; worth saying out loud before a walkthrough.
