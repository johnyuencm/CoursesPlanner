# Spec review — ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3

- **Reviewer role:** spec_reviewer (independent; not the implementer)
- **Repo:** `C:\Users\user\Desktop\github\CoursesPlanner`
- **Reviewed state:** `fix/complete-prereq-graph` product commit `4a9be0d10acb7b2e47d2dd73fcfa003d946953d8` (HEAD `1d0a239` is harness-ledger only; product files match `4a9be0d`)
- **Ticket status when reviewed:** `done`, `code_changed: true`
- **Verdict:** **PASS** (4/4 acceptance criteria met; no high findings)
- **Product files modified by me:** none. Only this artifact was written.

No `design.md` / `implementation-plan.md` / `prd.md` exists under the goal directory. Alignment is judged against `.ycm-harness/state.json` ticket brief plus the four acceptance criteria.

Implementer commit in scope: `4a9be0d` (in-page find helpers, `/map` Ctrl/Cmd+F capture, Enter/F3 cycle, off-screen pan fallback, Escape clear).

## Execution evidence I ran myself

| Command / probe | Result |
| --- | --- |
| `git rev-parse HEAD` / `git branch --show-current` | `1d0a239476cf985dd832b4e020218c5100917f7c` on `fix/complete-prereq-graph` |
| `git diff --stat 4a9be0d HEAD` | Only `.ycm-harness/events.jsonl` and `.ycm-harness/state.json`. Product tree equals `4a9be0d`. |
| `npm test` | `tests 45 / pass 45 / fail 0 / todo 0`, ~2.31 s. Includes `findCourses matches compacted codes and titles…` (`tests/graph.test.ts:109-123`), `findCourses on the MSCS snapshot locates CS 5500 and PHYS 5116` (`:125-131`), `wrapFindIndex and auto-locate match Ctrl+F next/previous behavior` (`:133-144`). |
| `npm run typecheck` (`tsc --noEmit`) | Exit 0, no diagnostics. |
| Provided verify log `.ycm-harness/smoke-logs/evidence-40652cb9.log` | Exit 0, 45/45, typecheck ran. Same command as my re-run. |
| `TODO\|FIXME\|XXX` in `lib/graph.ts`, `components/course-graph.tsx`, `tests/graph.test.ts` | No matches. |
| Test deletions `git log --diff-filter=D 4a9be0d^..4a9be0d -- tests` | Empty (no deleted test files). `tests/graph.test.ts` +40 lines only. |
| Live `/map` Ctrl+F / Enter / Escape / camera pan | **Not executed.** `next dev` is listening on `http://localhost:3000` (`GET /map` 200 in that server log). Cursor browser tab create/navigate returned `No browser tab available`. Criteria 1–3 are judged from handler wiring plus unit tests, not a trusted-keystroke session. |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | On /map, Ctrl+F or Cmd+F focuses the graph find field and does not open the browser find bar | **met** | `/map` is only `CourseGraph` (`app/map/page.tsx:6-9`). Find field is `#graph-find` with `aria-keyshortcuts="Control+F Meta+F"` (`components/course-graph.tsx:246-252`). A capture-phase `window` `keydown` listener treats `ctrlKey \|\| metaKey` plus `f`/`F` (and not Alt) as find: `event.preventDefault()`, then `findInputRef.focus()` and `select()` (`:176-196`, `:181-186`). `preventDefault` on that path is the mechanism that keeps the native find bar from opening. **Trusted Ctrl+F was not pressed in a browser in this pass.** |
| 2 | Typing a course code or title lists matches; Enter or F3 jumps to the next match and pans if it is on the current view | **met** | `findCourses` matches compacted code **or** title (`lib/graph.ts:246-272`; title case `tests/graph.test.ts:120` `"discrete"` → `CS 1800`). Non-empty `search` renders `#graph-find-results` buttons for every match (`components/course-graph.tsx:282-296`). Enter on the field calls `cycle` (`:258-261`); F3 (and Shift+F3) is captured on `window` and calls `cycle` (`:188-192`). `cycle` uses `wrapFindIndex` then `locate(code, true)` (`:227-233`; wrap cases `tests/graph.test.ts:134-139`). `locate` pans when `visible.has(code)` and view is graph (`:205-216` → `panTo` / `centerNode` / `setCenter` at `:197-204`, `:23-33`). Off-view matches switch to Immediate neighborhood instead of panning (`:209-210`), which is the “if it is on the current view” branch. |
| 3 | A query such as cs5500 or PHYS 5116 locates that course even when the node is off-screen; Escape clears the find field | **met** | Needle compaction strips spaces (`lib/graph.ts:240-242`). Fixture + snapshot tests: `findCourses(..., "cs5500")[0]` is `CS 5500`; `"PHYS 5116"` is `PHYS 5116` (`tests/graph.test.ts:118-119`, `:128-130`). Queries of length ≥ 4 auto-locate match 0 (`lib/graph.ts:280-283`; `components/course-graph.tsx:163-171`). Off-screen / culled React Flow nodes: `onlyRenderVisibleElements` stays on (`:341`); `panTo` uses `getNode` when present and otherwise `graph.nodes` layout + `setCenter` (`:197-204`), with a second rAF `panTo` (`:214-215`). Escape on the find field `preventDefault`s, `setSearch("")`, `setFindIndex(-1)`, and blurs (`:262-266`). **Live off-screen pan and Escape were not clicked.** |
| 4 | npm test and npm run typecheck pass | **met** | Re-run in this review: 45 passed, 0 failed, 0 todo; `tsc --noEmit` exit 0. Matches `evidence-40652cb9.log` (45/45, typecheck, exit 0). Distinct from implementer claim; same commands. |

## Design alignment

No separate design doc. The change matches the ticket brief: browser find cannot see culled React Flow nodes; `/map` gets an in-page find focused by Ctrl/Cmd+F that lists matches and jumps (pan on-view, neighborhood if not on this view). Helpers live in `lib/graph.ts`; the previous toolbar search was reused rather than a second search box.

No silent fork of earlier map tickets: default depth remains `"program"` (`components/course-graph.tsx:97`); `onlyRenderVisibleElements` remains; inspector chips still call `focus` → `locate(..., false)` (`:236`, `:379`, `:382`).

## Honest done-state

- No TODOs in the ticket’s key files.
- Find matching is not mocked: snapshot tests parse cached official HTML via `seattleGraph()`.
- No tests deleted or weakened; three new test blocks were added.
- Keyboard capture, native find-bar suppression, and camera pan are **not** in the verify suite. That is an evidence gap, not a leftover stub in the UI code.
- Ticket `status: done` / `code_changed: true` matches `4a9be0d`.

## Scope

**Required work is present.** Extra / adjacent (not required by the written criteria, not a silent substitute):

- Ctrl/Cmd+G as find-next (`components/course-graph.tsx:188-192`).
- ArrowUp / ArrowDown on the field (`:267-273`) and prev/next icon buttons (`:277-280`).
- Auto-locate when the query is one match or ≥ 4 compacted characters (`lib/graph.ts:280-283`), so `cs5500` / `PHYS 5116` jump without waiting for Enter.
- Match list no longer `slice(0, 8)` (old toolbar search); all catalog hits are listed.
- Table-row highlight / `scrollIntoView` when find runs in table view (`:211-212`, `:356`).

None of these replace a missing required path.

## Findings

### medium

1. **While a native course `<dialog>` is open, the written Ctrl+F skip does not match the markup, so the shortcut can neither open browser find nor reliably focus `#graph-find`.** The listener returns early only for `closest("[role='dialog']")` (`components/course-graph.tsx:179`). Modals are a native `<dialog>` with `showModal()` and **no** `role="dialog"` attribute (`components/ui.tsx:11-20`, used from `/map` via `openCourse` / `CourseDetail`). `[role='dialog']` does not match implicit ARIA role, so the early return never fires. `preventDefault` still runs (browser find stays closed) while focus on `#graph-find` can be blocked by modal inertness. Default `/map` with no drawer still has the AC1 wiring. Not scored high: the criterion’s main path is the map without a details overlay.

### low

2. **Escape clear is field-scoped, not window-scoped.** Clear/blur lives on the find input `onKeyDown` (`components/course-graph.tsx:262-266`). After the user clicks the canvas, Escape does not clear the query. AC3 is still met for the Ctrl+F → type → Escape path while the field is focused.

3. **F3 / Ctrl+G are only intercepted when `matchesRef.current.length` is already non-zero** (`:189-192`). An empty find field leaves native F3 to the browser. AC2 asks F3 to jump to the next match, which requires matches; this is not an unmet jump path.

## Limits of this review

I re-ran `npm test` and `npm run typecheck` on the submitted product files and read the `/map` find handlers. I did **not** deliver a trusted Ctrl+F / Cmd+F, F3, or Escape to the running app, and I did not observe React Flow `setCenter` for an off-screen node. Do not treat this artifact as live-camera or native-find-bar proof.

No numeric score assigned. No `ycm-harness review *` command run. No harness review JSON written.
