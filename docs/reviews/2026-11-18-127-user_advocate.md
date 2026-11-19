---
ticket: johnyuencm/CoursesPlanner#127
role: user_advocate
phase: 2
branch: fix/127-build-tracked-only
base_sha: 04e51ff
reviewed_head_sha: a5e2ad75d46c39961ea8772df48fa9818e14f373
verdict: PASS
---

# #127 user advocate review

## Verdict

PASS. The developer now gets a working build when local crawl output is bad. The build output does not change. Visitors see no change. Two `low` findings, both about how a developer finds a bad local status file in dev. No `high` or `medium` findings.

## Users and job

```
developer / crawl operator            site visitor
  npm run build  ──► dist/_snapshots    (production ships dist only)
  npm run dev    ──► /api/roadmaps
  catalog:refresh --roadmap / --list-*
```

- Developer job: build and deploy from a machine that also holds crawl output under `data/catalogs/`.
- Visitor job: open a published roadmap. Production reads only tracked snapshot files.

## Live evidence

All runs used exports of `04e51ff` (base) and `a5e2ad7` (head) in the session scratchpad. Each run planted `{"broken": true}` as `data/catalogs/northeastern/.roadmap-crawl-status.json`. No file was written to the repo.

### Build (`npx vite build`)

| Tree | Status file | Exit | Result |
|---|---|---|---|
| base | invalid | 1 | `Error: Published snapshot northeastern/computer-science-mscs-sea-8b0d00dbda is missing or invalid: Roadmap crawl status must be a version 1 object` |
| head | invalid | 0 | `Build complete.` |
| head | none | 0 | `diff -r` of `dist/client/_snapshots` against the invalid-file run: identical |
| base | none | 0 | `diff -r` against head invalid-file run: identical |

The issue acceptance holds live. The build output is byte-equal with or without the ignored file, and equal to the base output. Visitors get the same shipped files.

### Roadmap API (real `handleRoadmapsRequest` from `app/api/roadmaps/route.ts`, `rootDir` = scratch tree)

I could not run `next dev` on a scratch copy. Turbopack refused the `node_modules` symlink (`Symlink node_modules could not be resolved`). `next dev --webpack` loaded an unrelated instrumentation hook from a parent folder. The auto-mode classifier blocked a plant of the status file in the repo itself. So I called the exported route handler directly with `NextRequest`. This is the same function that `GET` calls. It is not a full HTTP run.

| Case | `(list)` | `?university=northeastern` | `&program=<published id>` | `&program=nope` |
|---|---|---|---|---|
| base, invalid status | 503 | 503 | 503 | 503 |
| head, invalid status | 503 | 503 | **200** | 404 |
| base, valid `ready` status | 200 | 200 | 200 | 404 |
| head, valid `ready` status | 200 | 200 | 200 | 404 |
| base, `ready` status, `programs.json` missing | 503 | 503 | 503 | 503 |
| head, `ready` status, `programs.json` missing | 503 | 503 | **404** | 404 |

All 503 bodies are `{"error":"Roadmap data is temporarily unavailable."}`. All 404 bodies are `{"error":"Unknown roadmap program."}`.

### Crawl CLI (`npx tsx catalog-service/cli.ts`, head, invalid status)

| Command | Exit | Output |
|---|---|---|
| `--list-universities` | 1 | `Roadmap crawl status must be a version 1 object` |
| `--list-programs --university=northeastern` | 1 | same |
| `--roadmap=computer-science-mscs-sea-8b0d00dbda --university=northeastern` | 0 | roadmap JSON |

### Tests

`npx tsx --test tests/snapshot-manifest.test.ts tests/published-programs.test.ts`: `# pass 21`, `# fail 0`.

## Is the program/university split confusing in dev?

Not in the UI. `components/roadmap-selector.tsx:191` loads the university list first. With an invalid status file, that call gives 503. The developer sees "Roadmap data is temporarily unavailable." and cannot reach the program picker. The roadmap fetch (`components/roadmap-selector.tsx:234`) runs only after a program is chosen (`:278`). So the UI never shows the 200 roadmap next to a 503 list. The split shows only with direct `curl` or the CLI. A developer who uses those tools is reading the data layer on purpose. The PM medium is real at the API level, but it has low user impact.

## Findings

### low-1: The build no longer surfaces a corrupt local status file, and dev hides the cause

- Before: the build printed the exact cause (`Roadmap crawl status must be a version 1 object`). That was the wrong place, but it was the only clear signal outside the CLI.
- Now: the build is silent (correct per #127). In `npm run dev`, the UI shows only "Roadmap data is temporarily unavailable." `safeReadError` (`app/api/roadmaps/route.ts:31-37`) maps the cause to a generic 503 and nothing logs it to the dev terminal.
- The message does not name the file or a recovery step (delete the file or re-run `--crawl-roadmaps`). The CLI message also does not name the file path.
- Impact: a developer with stale crawl output gets a dead selector in dev and must guess the cause. This is older than #127. #127 removes one accidental hint. Severity `low`: dev only, recoverable, the CLI shows the cause.

### low-2: The same bad local state gives different answers on different endpoints

- Evidence: the head rows in the API table above. `&program=` gives 200 or 404; the list and `?university=` give 503.
- The "`ready` status, `programs.json` missing" case gives 404 "Unknown roadmap program." for a program that is published. That text is misleading: the program is known, the local directory is broken.
- Impact: dev and CLI only. Production has no status file and always has the tracked `programs.json`. Same as the PM medium; I rate the user impact `low` because the UI cannot reach the split (see above).

## Problem solved?

Yes. The stated problem is "an invalid ignored file makes `npm run build` fail, and the build depends on an untracked file". The build now reads only tracked files, passes with an invalid file, and gives identical output. `docs/deploy.md` states the rule in the build bullet, where a developer looks.

## Interaction design

There is no changed interactive surface. The change touches build behaviour and server read paths. The UI code did not change. The surfaces a user meets are build output, API error text and CLI error text.

| Rule | Note |
|---|---|
| Consistency | Build and `&program=` reads now agree (tracked files only). List and `?university=` reads still use the status file. Mixed, see low-2. |
| Shortcuts | No change. `npm run build` needs no new flag. |
| Informative feedback | Build: good (no false failure). Dev API: generic 503 with no cause, see low-1. |
| Closure | Build ends with `Build complete.` and a correct output. |
| Simple error handling | CLI names the problem but not the file or the fix. Dev API names neither. |
| Easy reversal | Delete the ignored status file or re-crawl. Nothing irreversible. |
| Internal locus of control | Improved. The developer's local crawl state no longer blocks a deploy. |
| Short-term memory load | No change. The developer does not need to remember to clean `data/catalogs/` before a build. That is an improvement. |
| Clarity / hierarchy / accessibility | No visual change. Not applicable. |

## App UI mechanics

No app screen changed (`git diff 04e51ff...a5e2ad7 --stat` touches only `lib/`, `tests/`, `docs/`). The `designing-ux-mechanics` stress walk and checklist do not apply. I did not run them.

## What I did not check

- A full `next dev` HTTP run (blocked, see above). The direct handler call covers the same code path.
- The deployed Worker. The byte-equal snapshot diff covers what visitors receive.

## ack_zero_findings_reason

Not used. Two `low` findings are listed.
