# Deployment

Live production: [https://courses-planner.vercel.app](https://courses-planner.vercel.app)

This file is operator notes. Students using the planner do not need it.

## Project

| Item | Value |
| --- | --- |
| Production URL | https://courses-planner.vercel.app |
| Vercel project slug | `courses-planner` |
| Vercel team slug | `johnyuen97gmailcoms-projects` |
| Vercel team name | johnyuen97gmailcom's projects |
| Vercel team / org ID | `team_TElYupD3mNDEAbAvFYHpdJe5` |
| Vercel plan | Hobby |
| Framework | Next.js |
| Root directory | `./` |
| Production Git branch | `master` (this repo does not use `main`) |
| GitHub repository | [johnyuencm/CoursesPlanner](https://github.com/johnyuencm/CoursesPlanner) (currently **public**) |

The production URL was confirmed live (HTTP 200, Next.js on Vercel). The team ID above was confirmed from Vercel team settings. The Vercel **project ID** (`prj_…`) could not be re-read from project settings in the same pass, so it is not committed and should be copied from the dashboard before enabling the Actions CLI deploy:

Vercel → `courses-planner` → Settings → General → Project ID.

A create-time ID of `prj_8Kn1vTklOGl4BQ3HXCSwP9ghX4HS` was recorded elsewhere; treat it as unconfirmed until it matches that settings page.

`.vercel/project.json` is not in this repo yet. After `npx vercel link` (or after you confirm both IDs), that file may be committed. It contains `orgId` and `projectId` only. Never commit tokens, `.env*` files, or `.vercel/output`.

## How continuous deployment works

**Primary path:** Vercel Git integration. The Hobby project is linked to this GitHub repository. Pushes to `master` create production deployments. Pull requests and other branches create preview deployments. The Vercel GitHub app comments preview URLs on PRs. GitHub Actions does **not** create preview deployments; that would duplicate the Git integration.

**Checks path:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on pull requests and on pushes to `master`. It uses Node 22, then `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`. Any failed step fails the job. PRs run this job only; they do not production-deploy from Actions.

**Optional CLI path:** the same workflow has a `deploy` job that `needs: ci` and runs only on push to `master`. It follows Vercel’s documented GitHub Actions pattern (`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`). It is gated on repository secrets. If those secrets are missing, the job succeeds and skips the CLI deploy. Vercel Git integration still deploys `master`.

Until the secrets exist, Git integration is the only production deploy. After they exist, a push to `master` can produce **two** production deployments (Git integration immediately, then Actions after CI). If that duplication is unwanted, either leave the Actions secrets unset and keep Git integration as the only CD, or ignore Git production builds in the Vercel project and let Actions own production after CI is green.

Catalog refresh is not part of deploy or CI. Production serves the committed snapshot under `data/`. Refresh remains a local/operator CLI (`npm run catalog:refresh`). `POST /api/catalog` stays locked down outside development.

## Hobby plan and a public GitHub repo

Hobby can use Vercel Git integration against this repository because the GitHub repo is **public**. Making the repository private again requires **Vercel Pro** for the team’s private Git deploys. Do not privatize the repo on Hobby without first confirming that Git deploys will still run, or production updates will stop.

Tokens and org/project IDs are not affected by that Git-visibility rule; they only matter for CLI and Actions.

## GitHub Actions secrets (optional CLI deploy)

The `deploy` job needs all three repository secrets. They are not required for CI, PR checks, or Vercel Git integration.

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | [Vercel account tokens](https://vercel.com/account/tokens) (or `npx vercel tokens create`). Grant access to the Hobby team that owns `courses-planner`. |
| `VERCEL_ORG_ID` | The team ID: `team_TElYupD3mNDEAbAvFYHpdJe5`. Also written as `orgId` in `.vercel/project.json` after `vercel link`. |
| `VERCEL_PROJECT_ID` | Vercel → `courses-planner` → Settings → General → Project ID. Also `projectId` in `.vercel/project.json`. |

Set them in GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Do not put them in workflow YAML, README, or committed JSON.

Local/CI `vercel pull` can use either committed `.vercel/project.json` or the `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` environment variables. This repo currently relies on the secrets (or a future `project.json`) because the project ID is unconfirmed.

## Re-deploy production

Any one of:

1. Push or merge to `master` (Vercel Git integration; primary).
2. Vercel dashboard → `courses-planner` → Deployments → ⋮ on a deployment → **Redeploy**.
3. After `npx vercel link` to this project: `npx vercel deploy --prod`.
4. Push to `master` once the three Actions secrets are set (CLI deploy job in `ci.yml`, after CI is green).

Rollback: Vercel dashboard → Deployments → promote an earlier production deployment, or `npx vercel rollback` when linked.

## Local Vercel CLI

Requires Node 22+ and a Vercel login with access to the Hobby team.

```bash
npx vercel login
npx vercel link --scope johnyuen97gmailcoms-projects --project courses-planner --yes
npx vercel pull --yes --environment=production
```

`vercel link` writes `.vercel/project.json`. Commit that file only after the IDs match the dashboard. Keep using `.gitignore` so `.vercel/output` and pulled env files stay untracked.
