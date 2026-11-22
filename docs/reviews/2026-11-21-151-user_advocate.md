---
reviewed_head_sha: aeda4f498bd368f4c4b7f7f75f7af4cb8b54e12b
verdict: PASS
---

# #151 review: user advocate (round 1)

- Ticket: johnyuencm/CoursesPlanner#151.
- Branch: `fix/151-lost-programs-json`, stacked on `fix/136-roadmap-read-errors` (PR #152).
- Diff: `git diff origin/fix/136-roadmap-read-errors...aeda4f4` (5 files in `lib/` and `tests/`).
- Phase 1: `docs/reviews/2026-11-21-151-tech_lead.md` (PASS), `docs/reviews/2026-11-21-151-project_manager.md` (PASS).

## Verdict

PASS. No high finding. One medium finding (the same as phase 1 M1, fix now). Six low findings (defer).

## User and job

- User: a developer who runs the app with local crawl output in `data/catalogs/`.
- Job: when local data is broken, the app tells the true cause and the place. The developer then fixes the right file fast.

## Live walk (what I ran)

I used a throwaway worktree at `.worktrees/ua151` (ignored by `.gitignore`), detached at `aeda4f4`.
I removed the worktree after the walk. I stopped the dev server. I deployed nothing.

```
state A: programs.json removed      state B: programs.json truncated (300 bytes)
          |                                   |
   CLI / build / dev API / selector    CLI / build / dev API / selector
          |                                   |
   state C: valid JSON, top-level universityId changed (schema check)
          |
   restore file -> GET /api/roadmaps 200
```

### State A: file missing

| Surface | Command | Result |
|---|---|---|
| CLI | `tsx catalog-service/cli.ts --roadmap=computer-science-mscs-sea-8b0d00dbda --university=northeastern` | `Program list is missing: data/catalogs/northeastern/programs.json`, exit 1 |
| CLI | `--list-programs --university=northeastern` | exit 0, `"programs": []`, `"status": "queued"` (known, #155) |
| CLI | `--list-universities` | exit 0, normal list |
| Build | `npm run build` | exit 1, `Program list is missing: data/catalogs/northeastern/programs.json` |
| Dev API | `GET /api/roadmaps`, `?university=northeastern`, `&program=...` | all 404 `{"error":"The program list (programs.json) is missing."}` |
| Dev log | `next dev` output | no line for the 404 |
| Selector, 390 px | `/northeastern/computer-science-mscs-sea-8b0d00dbda/explore` | panel opens; "Unable to load universities: The program list (programs.json) is missing." + "Retry loading universities"; no horizontal scroll |
| Selector, 1280 px | same page | same text on one line; no horizontal scroll |
| Retry | click "Retry loading universities" | "Loading universities…" then the same error; focus goes to `<body>` |

The page header above the selector shows "Explore · NEU MSCS Seattle" and loads correctly.
So the screen shows Northeastern data that works, next to an error that does not name a university.

### State B: file corrupt (truncated JSON)

| Surface | Result |
|---|---|
| CLI `--list-universities`, `--list-programs`, `--roadmap` | exit 1, `Program list is invalid: data/catalogs/northeastern/programs.json: Unterminated string in JSON at position 300 (line 10 column 50)` |
| Build | exit 1, same line, no "Published snapshot" prefix |
| Dev API (3 paths) | 503 `{"error":"The program list (programs.json) is invalid."}` |
| Dev log | `Roadmap read failed: Program list is invalid: data/catalogs/northeastern/programs.json: Unterminated string ...` once per request |
| Selector, 390 and 1280 px | "Unable to load universities: The program list (programs.json) is invalid." + retry; no horizontal scroll |

### State C: valid JSON that fails the schema

- CLI: `Program list is invalid: data/catalogs/northeastern/programs.json: Discovered program is invalid: computer-science-mscs-align-a4f8db6b17`.
- Dev API list: 503 "invalid".
- I changed only the top-level `universityId`. The message names the first program, not the field (see L5).

## Judgment of the texts

| Text | True? | Actionable? |
|---|---|---|
| CLI / build "missing: data/catalogs/<id>/programs.json" | yes | yes: full path |
| CLI / build / log "invalid: <path>: <cause>" | yes | yes: path, line and column for JSON |
| HTTP / selector "programs.json is missing" | yes | partly: no university, no log line (M1) |
| HTTP / selector "programs.json is invalid" | yes | yes in dev: the log line gives the path |

The issue goal is met. A lost file no longer reads "Queued ... waiting for crawl" on the HTTP path. The text names the real cause.

## Does the status legend mislead?

No, not in a way that sends the developer to the wrong file.
The legend explains the labels of the options in the university and program lists.
When the list load fails, the select has only "Current program (default)", so no option carries the "Queued" label.
But the legend sits above the error and takes 3 lines at 390 px. It is noise in the failed state (L3).

## Findings

| Id | Severity | Finding | Evidence | Fix now or defer |
|---|---|---|---|---|
| M1 | medium | The missing-file answer does not name the university and writes no log line. The selector sits under a working Northeastern page, so the developer cannot see which folder lost its file. The corrupt case is fine: its log line has the full path. | `lib/roadmap-reader.ts:24`, `:39`; live dev log had no line for the 3 404s | Fix now (planned in the architecture pass). Same as tech lead M1 and project manager M1. |
| L1 | low | CLI `--list-programs` gives exit 0 and `"status": "queued"` for a lost file. `--roadmap` for the same state says "missing". Two commands disagree. | live CLI, state A | Defer: tracked in #155. |
| L2 | low | One lost file hides all 40 universities. The select shows only the default option. | live selector, state A; `lib/roadmap-reader.ts:158-166` | Defer: dev-only state, build blocks it (same as phase 1 J1). |
| L3 | low | The status legend shows above the load error. It explains options that are not there. | `components/roadmap-selector.tsx:97-104`; 390 px walk | Defer: pre-existing layout, not false text. |
| L4 | low | After "Retry loading universities", focus goes to `<body>`. A keyboard user loses the place. | live click, `document.activeElement` = body | Defer: pre-existing selector mechanic, not from this diff. |
| L5 | low | A schema failure names a program id, not the field that is wrong. The path is correct, so the developer opens the right file. | state C; `lib/catalog.ts:520` | Defer: pre-existing validator text. |
| L6 | low | `GET /api/roadmaps` (the list) answers 404 when one file is lost. | live API | Defer: same as phase 1 L1. |

Out of scope, seen during the walk (not from this diff):

- `next dev` printed `Removed agent rules from AGENTS.md because agentRules is disabled` and changed `AGENTS.md` in the worktree. A developer who runs `npm run dev` gets a dirty tree. `AGENTS.md` already documents this `next dev` behavior.
- `next dev` printed a Next.js security advisory for the installed version. I did not act on it.

## Interaction design (Shneiderman)

| Rule | Note |
|---|---|
| Consistency | The three API paths give the same status and text for each state. CLI and build use one line format. The CLI `--list-*` commands still differ (L1). |
| Shortcuts for frequent users | Not applicable. No new command or control. |
| Informative feedback | Good for corrupt (path, line, column). Weak for missing on HTTP (M1). |
| Closure | CLI and build end with exit 1 and one line. The selector shows a fixed error with retry. |
| Simple error handling | The text names the file. It does not say how to restore it (`git checkout` or a re-crawl). Acceptable for dev. |
| Easy reversal | Restore the file: the list returns 200 at once. Nothing is written. |
| Internal locus of control | No prompts. Retry is manual. |
| Short-term memory load | One line holds cause and path in CLI and build. In the UI the developer must remember the URL to find the university (M1). |
| Clarity and hierarchy | Short text. The legend above the error lowers the hierarchy (L3). |
| Accessibility | The status area has `role="status"` and `aria-live="polite"`. The error is text, not color only. Focus loss on retry (L4). No horizontal scroll at 390 px. |

## App UI mechanics

- This diff changes no screen code. It changes only `lib/` data reads, so the selector reaches its existing error state.
- I did not run `stress-walk.mjs`. No changed screen exists to configure, and the error state is pre-existing. I walked the relevant manual items instead.

| Item | Result | Reason |
|---|---|---|
| D4 error in place, says what to do, retry | PASS (partial) | In place, with retry. "What to do" is implied by the file name only. |
| D1 no empty state before the first answer | PASS | "Loading universities…" shows during load. |
| A1 press responds within 100 ms | PASS | Retry shows "Loading universities…" at once. |
| L3 focus returns to trigger | FAIL (low) | Focus goes to body after retry (L4). Not a layer; pre-existing. |
| N1-N6, L1, L2, A2-A6, M1-M5 | NOT TESTED | No navigation, layer, send action or live data changed in this diff. |

## Problem solved?

Yes. The developer now sees the true cause on every surface. CLI and build give the exact path.
In dev, the corrupt case logs the path. The missing case on HTTP still needs M1 to name the university.
