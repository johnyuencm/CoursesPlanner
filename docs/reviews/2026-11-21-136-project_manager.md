---
reviewed_head_sha: ef988298480aa3285c74425a7c2354b544540285
verdict: PASS
---
# Review: #136 roadmap read errors (project_manager, round 1)

- Branch: `fix/136-roadmap-read-errors`. Diff: `git diff origin/master...ef98829`.
- Seat: project manager. This is an independent first pass. The tech_lead file `docs/reviews/2026-11-21-136-tech_lead.md` did not exist when I wrote this.

## Evidence that I ran myself at ef98829

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0, 370 tests, 370 pass, 0 fail |
| `npm run build` | exit 0, "Build complete." |

## Per-criterion map

| # | Acceptance criterion | State | Evidence |
|---|---|---|---|
| 1 | A missing local `programs.json` gives a text that names the missing file, not "Unknown roadmap program." | met | `lib/roadmap-reader.ts:142-144` throws kind `missing-programs`. The API text is "The program list (programs.json) is missing." (`lib/roadmap-reader.ts:24`). The CLI and build text is "Program list is missing: data/catalogs/<id>/programs.json". Route maps it at `app/api/roadmaps/route.ts:34`. Catalog service maps it at `catalog-service/server.ts:103-106`. |
| 2 | An unknown program id still gives 404 "Unknown roadmap program." | met | `lib/roadmap-reader.ts:138,146`. Test `tests/roadmaps-route.test.ts` (#136 test) asserts `{404, "Unknown roadmap program."}` on the route and on the catalog service. |
| 3 | Tests cover both. | met | `tests/roadmaps-route.test.ts` (#136 test): unknown university, unknown program, not-ready, and missing programs.json, on both handlers. `tests/snapshot-manifest.test.ts` (#127/#136 test): the "ready" crawl status case from the issue, plus the CLI message with the file path. |
| 4a | `npm run typecheck`, `npm test`, `npm run build` pass. | met | Table above. |
| 4b | Worker CPU per request does not go up. | met (by reading) | No Worker file imports `lib/roadmap-reader.ts`. The reader runs in dev and at build time. The new code on the request path is one `instanceof` check and one `crawlable()` call. Both are O(1). I did not measure CPU. |

## Design alignment

- The issue "Expected" section asks for one typed error with a kind. Both `app/api/roadmaps/route.ts` and `catalog-service/server.ts` must map each kind. The change does this with one table (`ROADMAP_READ_ERRORS`) that both handlers use. This is the agreed design.
- The change removes the string-prefix matching in both handlers. The test asserts that both handlers give the same status and body. This removes a drift risk.
- Behavior change: the catalog service now returns `{error: <short text>}` for known kinds. Before, it returned `errorBody(error, ...)` with the long message. This is a small contract change. The test pins it. I accept it, because the issue asks for one short true text.

## Goal alignment

- The change fixes the exact dev case that #127 found. It is small (5 files, +69/-23). I see no cheaper option that also covers the catalog service.
- `missing-programs` also fires for a crawlable university that was never discovered. The text "The program list (programs.json) is missing." is still true in that case. Before, it was "Unknown roadmap program.". I accept this.

## Scope honesty and deferrals

| Item | Status | Blocks close of #136? |
|---|---|---|
| Selector shows "Queued ... waiting for crawl" when `programs.json` is lost (`components/roadmap-selector.tsx:101`, from `readProgramDirectory()` at `lib/roadmap-reader.ts:109-119`). | Not fixed. Named in the implementer claim. | No. It is in the issue "Problem" section, but no acceptance criterion names it. Make a follow-up issue. |
| `invalid-programs` kind. | Skipped. An invalid `programs.json` gives the generic 503 "Roadmap data is temporarily unavailable." and one server log line with the cause (`app/api/roadmaps/route.ts:36-38`). | No. The issue lists it as "for example". The current answer is true and the log names the cause. Put it in the same follow-up issue as a low item. |

Check of the implementer claim "the selector is hidden in this state today":

- `components/roadmap-selector.tsx:84` returns `null` when no university is selectable.
- `lib/roadmaps.ts:29-31`: a university is selectable only when `counts.ready > 0`.
- Only `data/catalogs/northeastern/programs.json` exists. If it is lost, northeastern goes to `initialStatus` "queued" with `counts.ready = 0`. No university is selectable, so the selector is hidden.
- The claim is true today. It stops being true when a second university has ready programs. Then the lost-file university shows "Queued". The follow-up issue must say this.

## Findings

| Severity | Finding |
|---|---|
| medium | The selector "Queued" text named in the issue Problem section is not fixed. It is not an acceptance criterion and is hidden today. Do not block #136. Before you close #136, open a follow-up issue. Name `components/roadmap-selector.tsx:101`, `lib/roadmap-reader.ts:109-119`, the #127 reason (the app cannot tell "not discovered" from "file lost" with tracked files only), and the trigger (a second ready university). Link it from the PR body. |
| low | `invalid-programs` kind is skipped. The generic 503 plus the log line is honest. Add it to the same follow-up issue. |
| low | The catalog service body for known kinds changed from the long message to the short text. This is intended and tested. State it in the PR body. |
| low | "Worker CPU does not go up" is checked by reading only, not by a measurement. The Worker does not import the changed module, so the risk is very low. |

## Verdict

PASS. All four acceptance criteria are met with evidence. No high finding. The two deferrals are honest and named. They must go to one follow-up issue, which is linked from the PR before #136 closes.
