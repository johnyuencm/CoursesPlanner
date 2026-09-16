# tech_lead review — ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1

Verdict: **PASS** (round 1; no high findings)

Goal: double-click a course → GraphScope `"1"` (This course's connections) with a restore snapshot; Escape pops one stacked view after find-clear and line-focus, without stealing dialogs/selects/fullscreen.
Reviewed state: branch `land/local-graph-focus`. Product commit `520fab89dcb2dc4a8ab9ec7882de9452e2144460`. HEAD may be harness-only after that commit. Reviewer is **not** the implementer. No product file was modified. This is the only file written.
Diff inspected: `git show 520fab8 -- lib/graph.ts components/course-graph.tsx tests/graph.test.ts` (`+146 / −10`). No test deleted, skipped, or loosened.
`artifacts/review-project_manager-ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1.md` was present; this is still an independent first pass. PM had **no high/medium**. I did **not** live-drive `/map`.

## Evidence I ran myself

| Check | Result |
| --- | --- |
| `git show 520fab8 --stat` | `course-graph.tsx` +71/−10; `lib/graph.ts` +42; `tests/graph.test.ts` +43 |
| Helpers | `enterCourseConnectionsView`, `popGraphView`, `shouldRestoreGraphViewOnEscape` in `lib/graph.ts:712-752` |
| UI wiring | node/table `onDoubleClick`, `viewStack`, capture Escape, `locate`/`chooseScope` clear, inspector restore + neighborhood |
| Tests | `tests/graph.test.ts:685` stack/idempotency/pop; `:707` Escape restore gates |
| `npm test` (this seat) | **88 pass / 0 fail / 0 skipped / 0 todo** |
| `npm run typecheck` (this seat) | `tsc --noEmit` exit 0 |
| Live `/map` | **not driven** |

## Architecture

Fits the existing map instead of a second navigation system.

- Scope `"1"` already means neighborhood distance 1 (`lib/graph.ts:118-119`, `COURSE_CONNECTIONS_SCOPE` at `:712`). The ticket reuses it; it does not invent a parallel “connections” mode.
- Pure snapshot helpers live next to the other Escape/find predicates. `GraphWorkspace` owns React `viewStack` (`components/course-graph.tsx:119`) and applies `next`/`previous`. That split is the right cohesion: tests can pin enter/pop/gates without mounting React Flow.
- `GraphViewSnapshot` is only `{ depth, focusCode, zoom }` (`lib/graph.ts:714-718`). That matches AC1. Restoring does not rewrite `selectedCode`; the inspector stays on the drilled course while the map returns. Not a hidden second stack.
- Course-node `enterConnections` is a ref (`course-graph.tsx:129,192,415`) the same way `inspectRef` already avoids stale handlers inside `graph` memo data. Appropriate.
- `chooseScope` (`:391-395`) is the explicit-destination path (clear stack). `enterConnections` (`:377-389`) is the drill-in path (push unless same connections view). Inspector “Show neighborhood” now uses the drill-in path (`:616`); Show dropdown / entire program / locate use the clear path. That matches AC3 rather than overloading one function.
- Two histories remain (header Back/Next `navigation` vs `viewStack`). They do not join. Escape restores map snapshot only. Acceptable for this slice; not a rewrite trigger.

No abstraction that will force a later replacement. Stack-clear lives only in UI setters, which is the test gap below, not a wrong layer.

## Correctness

Happy path in source:

1. Double-click card (`:68`) or table course (`:579`) → `enterConnections` → `enterCourseConnectionsView` sets `depth: "1"`, `focusCode: code`, `zoom: GRAPH_READABLE_ZOOM` (1), returns `previous: current` (`lib/graph.ts:720-731`). UI pushes `previous` (`course-graph.tsx:380`) and applies next depth/focus/zoom plus selection (`:384-388`). `mapScene` uses `scope: depth` (`:151`).
2. Capture Escape: find listener is registered first (`:291-315`) and `mapFind.intent` type `"clear"` returns before restore. Restore effect (`:327-346`) clears line-focus first via `shouldClearLineFocusOnEscape`, then `shouldRestoreGraphViewOnEscape` + `popGraphView`. Restore helper bails on `lineFocus` and reuses line-focus target rules with `active: true` (`lib/graph.ts:742-751`), so find text, fullscreen, `input`/`select`/`textarea`, and `dialog, [role='dialog']` (`:664-667`) skip. Native `<dialog>` is in that selector; `components/ui.tsx:20` also sets `role="dialog"`. Restore does not `preventDefault` when the predicate is false, so fullscreen Exit keeps Escape (`course-graph.tsx:334`).
3. Same-course connections: `previous: null` (`lib/graph.ts:725-726`); UI pushes only when `previousView` is set (`course-graph.tsx:380`). Different code while already on `"1"` returns a new `previous` (stack). `locate` (`:351`) and `chooseScope` (`:392`) `setViewStack([])`. Search hits, auto-locate, cycle, and Focus map here all go through `locate`.
4. Stacked pop is `popGraphView` tail (`lib/graph.ts:734-739`). Inspector button shares that helper (`course-graph.tsx:397-404, 619`).

Edge cases inspected, not blockers:

- Same-tick Escape repeat closes over `viewStack` (`:336,346`) rather than a ref/functional pop. Two keydowns before paint can apply the same snapshot twice. Normal tap-after-paint still pops one level. See TL-2.
- `enterConnections` on an already-current connections view still clears line-focus and refocuses the inspector. AC3 only forbids a duplicate push.
- Canvas `zoomOnDoubleClick={false}` (`components/graph-canvas.tsx:140`) so the node button handler is the intended dblclick path. Not live-proven.
- Restore does not snapshot scroll offsets; AC names depth/focus/zoom only. `selectedGraphScroll` may pan to the still-selected drilled course after layout (`graph-canvas.tsx:115-125`). Consistent with keeping `selectedCode`.

No races that look like data loss. No idempotency hole on same-course connections. Hooks stay above `if (!catalog)`.

## Tests

Two tests **added**. None skipped, todo, or disabled. Asserts check the real helpers, not mocks of the UI.

- `:685-705` locks program → CS 5500 connections @ zoom 1 with previous kept; same-course `previous === null`; second course stacks; two pops return connections then program; empty pop is null.
- `:707-722` locks restore true on inspector/pane/null target; false for empty stack, line-focus, findQuery, fullscreen, role=dialog, Show `<select>`, non-Escape.

Silent gaps (not false-green): React `setViewStack([])` on locate / Show dropdown / Show entire program is unwired in the suite. Escape capture order (find listener vs restore listener) is implied by helper composition + registration order, not dispatched as window events. Not a high: no test was weakened to go green.

## Operations

Rollback is revert of `520fab8`. No persistence, flags, or network. `viewStack` is session UI state. Extra capture listener on `window` is cleaned up (`course-graph.tsx:344-345`) and only `preventDefault`s when restore actually runs. Catalog-scale neighborhood layout is the existing `"1"` path. Holding Escape may be one pop per paint because of the stale stack closure; not an ops incident.

## Security

No new trust boundary. Capture Escape can steal a key; skip rules reuse `isGraphFindSkipTarget` (`dialog, [role='dialog']`) and tag checks for select/input. Course codes are existing catalog strings rendered as React text. No secrets, no injection surface, no destructive commands.

## Code health

Easier to evolve: named enter/pop/restore predicates, `chooseScope` vs `enterConnections` split, status copy for connections (`course-graph.tsx:535`), hint copy (`:587`). Duplicate restore application in the key handler and `restorePreviousView` is small. `GraphWorkspace` is still large; this is a bounded island (one state array, one effect branch, four functions). Acceptable.

## Findings

None high or medium.

- `low` `tests/graph.test.ts:685` vs `components/course-graph.tsx:351,392`: AC3 stack-clear on locate / Show dropdown / Show entire program is visible in UI (`setViewStack([])`) but not asserted. A wiring regression would not fail `npm test`.
- `low` `components/course-graph.tsx:336,346`: Escape restore reads `viewStack` from the effect closure. Same-tick key repeat can pop the same snapshot twice instead of two levels. `searchRef` already exists for this class of stale key input; the stack did not get a ref or functional pop.

## Debate round 1

Independent pass (did not wait on PM to form the verdict). Read `artifacts/review-project_manager-ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1.md` after inspecting `520fab8`.

- PM **high/medium**: none. No concession or rebuttal required.
- PM `low-1` (untested locate/dropdown/entire-program clear): **concede**. Same finding, file:line above.
- PM `low-2` (live `/map` not driven): process/evidence note, not a product defect. This seat also judged from source + helper tests + `npm test` / typecheck. Not copied as a code finding.
- PM risk note on stale `viewStack` during rapid Escape: **restated as TL low** at `course-graph.tsx:336,346`. Not a high: paint-separated Escapes still walk one level.

Phase 1 can settle: both seats PASS, no unrebutted high.

## Verdict rationale

Architecture reuses GraphScope `"1"` and isolates snapshot math in tested helpers. AC1–3 are present in `520fab8` source. AC4 is green on this seat (88 tests, clean `tsc`). Residual issues are an untested UI stack-clear and a stale Escape closure — low, not blockers under the high bar (data loss, security, irreversible bugs, false-green skips).
