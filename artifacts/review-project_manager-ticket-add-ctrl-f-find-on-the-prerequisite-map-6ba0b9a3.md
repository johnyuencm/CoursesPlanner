# project_manager review — ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3

Verdict: **PASS** (round 1; no high findings)

Goal: Complete MSCS Seattle prerequisite graph (still **active**). This ticket is
the bounded Ctrl+F / in-page find slice. Prior tickets (full node set, LTR flow,
titles + selected-chain arrows) stay done. Reviewer is **not** the implementer.
The only file written by this review is this artifact. Do **not** complete
`goal_complete-mscs-seattle-prerequisite-graph_5f65` from this pass.

Reviewed state: branch `fix/complete-prereq-graph`. Product commit `4a9be0d`
("Add Ctrl+F course find on the prerequisite map"). HEAD `1d0a239` is harness
ledger only (`Start the Ctrl+F map-find ticket`). Working tree product files
match `4a9be0d`; dirty files are `.ycm-harness/state.json` and `events.jsonl`
(submit + verify recorded after HEAD). Named leftovers from prior work (MiniMap
clip, completed-as-color-only, dangling chips, explorer keyword spill, unlabeled
isolate band, first-paint CS 5500 off-screen) are **out of this ticket** and
were **not** silently marked done.

Harness `status: "done"` was **not** treated as proof. Verify evidence
`evidence-40652cb9` exists and PASSed `npm test && npm run typecheck` with
distinct `find-impl-r1` / `find-ver-r1`. No `design.md` / `implementation-plan.md`
/ `prd.md` under the goal directory; acceptance is the ticket text.

## Evidence I inspected

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` | `1d0a239476cf985dd832b4e020218c5100917f7c` |
| Product | `4a9be0d10acb7b2e47d2dd73fcfa003d946953d8` is ancestor of HEAD |
| `git diff --stat 4a9be0d^..4a9be0d` | `course-graph.tsx` +156/−; `lib/graph.ts` +45; `tests/graph.test.ts` +40; `globals.css` +12/−. **+235 / −18**. No test deleted. |
| `evidence-40652cb9` | exit 0; **45 pass / 0 fail / 0 skip / 0 todo**; includes the three new find tests; `tsc --noEmit` clean |
| HEAD harness vs working tree | HEAD ticket `in_progress`, no evidence keys; working tree ticket `done` + `evidence-40652cb9` (**PM-5**) |
| `TODO`/`FIXME`/`HACK` in `lib/` `components/` | none |
| Published snapshot find | `findCourses(..., "cs5500", onMap)[0] === CS 5500`; `PHYS 5116` likewise. Both `programMapCodes` members. Map size 114. |
| Laid positions (default comparator) | CS 5010 `{x:0,y:2288}` (default selected / onInit center); CS 5500 `{x:188,y:312}`; PHYS 5116 `{x:0,y:1248}`. At zoom 1 those two targets are off the first-paint camera. |
| Live `/map` Ctrl+F | **not done** — no browser session in this review (**PM-1**) |
| Leftover files in this diff | MiniMap / `nodeClassFor` completed-first / explorer page / isolate hint copy / default `CS 5010` camera **unchanged** |

## Per-criterion map

| # | Acceptance criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | On `/map`, Ctrl+F or Cmd+F focuses the graph find field and does not open the browser find bar | **met in source** | `/map` loads `CourseGraph` (`app/map/page.tsx:8-9`). Capture-phase `window` listener: `(ctrlKey \|\| metaKey)` + `f`/`F` + not `altKey` → `preventDefault`, `findInputRef.focus()` + `select()` (`components/course-graph.tsx:176-186,194-195`). Field is `#graph-find` (`:247-248`). Dialogs are skipped so a modal can still use browser find (`:180`). Not live-proven (**PM-1**). Loading `CatalogState` still intercepts with no input (**PM-3**). |
| 2 | Typing a course code or title lists matches; Enter or F3 jumps to the next match and pans if it is on the current view | **met in source** | Dropdown renders when `search.trim()` (`:282-296`). `findCourses` matches compacted code **or** title (`lib/graph.ts:246-272`); locked by `tests/graph.test.ts:109-123` (`cs5500`, `discrete`). Enter on the field calls `cycle` (`course-graph.tsx:258-261`); F3 / Ctrl+G captured on `window` (`:188-192`). `cycle` → `wrapFindIndex` → `locate(..., true)` (`:227-232`). On-map graph view calls `panTo` twice, including an rAF retry (`:213-215`). `panTo` uses `getNode` then laid `graph.nodes` so culled React Flow nodes still get `setCenter` (`:197-203`). Table view scrolls the row instead (`:211-212`). Helpers locked by `tests/graph.test.ts:133-144`. Pan itself is not in the verify command (**PM-1**). |
| 3 | Query `cs5500` or `PHYS 5116` locates that course even when the node is off-screen; Escape clears the find field | **met** (Escape when the field has focus) | Snapshot test `tests/graph.test.ts:125-131`. Auto-locate fires when needle length ≥ 4 or unique match (`lib/graph.ts:280-283`; `course-graph.tsx:163-171`) — both sample queries qualify. Default camera still centers `CS 5010` (`:93-94,330-332`), so CS 5500 at y=312 and PHYS 5116 at y=1248 are off-screen until find pans. Escape on the input clears `search` / `findIndex` and blurs (`:262-266`). After locate-with-keepFind, focus is returned to the input (`:225`), so Escape works in the main type-then-clear path. Escape is **not** a window-level close (**PM-2**). |
| 4 | `npm test` and `npm run typecheck` pass | **met** | `evidence-40652cb9`: 45/45, `tsc --noEmit` exit 0. Implementer `find-impl-r1` ≠ verifier `find-ver-r1`. |

## Goal alignment

Correct next slice, not a side-quest. The parent goal put ~114 official MSCS
Seattle nodes on `/map`. At readable zoom that canvas does not fit, and React
Flow's `onlyRenderVisibleElements` makes browser Ctrl+F blind. The user's ask
was an in-page find that can jump to off-screen courses (explicitly `cs5500` /
`PHYS 5116`). This ticket upgrades the existing graph search box into that
shortcut rather than changing first-paint camera or inventing a new page.

Cheaper alternatives (copy-only "use Fit to view", keep click-to-search without
intercepting Ctrl+F) were not taken. Scope stayed inside find ranking + keyboard
+ pan-on-match. No catalog snapshot, parser, or program-membership change.
Parent goal remains incomplete for the named leftovers; this ticket does not
pretend otherwise.

## Scope honesty

- No test deleted, skipped, or weakened. Three tests **added**
  (`tests/graph.test.ts:109-144`). They lock matching, wrap, and auto-locate
  thresholds — **not** the DOM listener or `setCenter` (**PM-1**).
- No mock standing in for find. No product TODO.
- Pre-existing graph search already listed catalog hits and jumped via `focus`.
  This diff adds Ctrl/Cmd+F intercept, Enter/F3/arrows, count, unlimited list
  (old `.slice(0, 8)` removed), auto-locate, and keep-find pan. That is the
  ticket, not a silent rewrite of layout or catalog.
- Leftovers **not** claimed: `.graph-panel` overflow (`app/globals.css:364`) and
  MiniMap (`:371`); `nodeClassFor` still returns `graph-completed` first
  (`course-graph.tsx:64-69`); dangling chips / explorer `/courses` untouched;
  isolate band still unlabeled (`:365`); default selected remains `CS 5010`
  (`:93-94`). First-paint CS 5500 off-screen is **why** find exists here, not
  a stealth close of that leftover.
- Extra vs the written AC (not unmet): Ctrl/Cmd+G, ArrowUp/Down, prev/next
  buttons, auto-locate while typing, table-row highlight. Auto-locate can jump
  before Enter, including off-program catalog hits (**PM-4**).

## Trade-offs and named deferrals

This slice:

1. Capture-phase Ctrl/Cmd+F on `/map` only (unmount removes the listener). Other
   routes keep browser find.
2. Off-screen-but-on-map → `panTo` laid coordinates; off-map catalog hit →
   neighborhood remount (`setDepth("1")`), same as inspector chips.
3. Auto-locate waits for 4+ compacted characters or a unique match so `"c"` /
   `"cs"` only **lists**.
4. Match list is no longer capped at 8; CSS `max-height: min(320px, 50vh)`
   scrolls instead (`app/globals.css:353`).
5. Default camera unchanged (CS 5010 / isolate band). Find is the workaround.

Still **out of this ticket** (prior panel / user; still open):

6. MiniMap clip.
7. Completed-as-color-only.
8. Dangling inspector chips / two closure rules.
9. Explorer keyword spill.
10. Unlabeled isolate band.
11. First-paint CS 5500 off-screen at zoom 1.

No new checkpoint on this ticket names those deferrals. They remain named in
`cp_manual_independent-review-pass_c70a` and in this review. That is enough for
this bounded ticket; it is **not** a parent-goal close.

## User impact

Visible value: on the program map, Ctrl+F focuses an in-page find, typing lists
courses, and a query like `cs5500` / `PHYS 5116` pans to a node browser find
cannot see. That is the user-facing job. Plumbing (`findCourses` scoring,
`wrapFindIndex`) is behind that. Topbar catalog search is unchanged; on `/map`
Ctrl+F now prefers graph find over the browser bar (intended).

## Risk surface

| Risk | Mitigation or not-done |
| --- | --- |
| Browser find still opens | Source `preventDefault` in capture; **unproven live** (**PM-1**) |
| Culled node: `getNode` misses | Laid-position `setCenter` + rAF retry (`course-graph.tsx:197-215`) |
| Escape does nothing after clicking the canvas | Input-only handler (**PM-2**) |
| Ctrl+F during catalog load | Listener registered before `CatalogState` return; input missing (**PM-3**) |
| Long query auto-opens a neighborhood for an off-map catalog course | Pre-existing click path; now also auto-locate (**PM-4**) |
| Huge `"cs"` result list | Scrollable dropdown; program-map hits ranked +1000 (`lib/graph.ts:260`) |

## Findings

### PM-1 — medium — keyboard intercept and camera pan are source-only

`evidence-40652cb9` never mounts `/map` or sends Ctrl+F. Tests cover
`findCourses` / `wrapFindIndex` / `shouldAutoLocateFind`
(`tests/graph.test.ts:109-144`), not `preventDefault` or `setCenter`.
AC1 ("does not open the browser find bar") and the pan half of AC2/AC3 are
implemented at `course-graph.tsx:176-215` but **unproven in a browser**. This
does not make those criteria missing; it is residual verification risk, same
class as the prior chip-pan gap.

### PM-2 — medium — Escape is not window-scoped

AC3 says "Escape clears the find field." The handler lives on the input
(`course-graph.tsx:262-266`), not on the capture listener (`:176-192`). Main
path refocuses the input after locate (`:225`), so type → locate → Escape
clears. If the user clicks the canvas first, Escape does nothing and the
dropdown stays. Not an unmet required path; named as browser-find parity gap.

### PM-3 — low — Ctrl+F swallowed while catalog is missing

Hooks and the key listener run before `if (!catalog) return <CatalogState />`
(`course-graph.tsx:163-196,237`). During that state `preventDefault` still
fires and `findInputRef.current` is null, so neither graph find nor browser
find works. Transient.

### PM-4 — low — auto-locate can leave the program map without Enter

AC2 sequences **list on type, jump on Enter/F3**. Extra auto-locate at 4
characters (`lib/graph.ts:280-283`) pans (or opens neighborhood) while typing.
Off-map catalog titles (old search already listed them; cap of 8 removed) can
now jump without a click. Does not break `cs5500` / `PHYS 5116` on the default
map. Extra, not a silent "explorer spill fixed."

### PM-5 — low — ledger lag, not product incompleteness

HEAD `1d0a239` still has this ticket `in_progress` with no evidence object.
Working tree marks `done` after verify and has no `ticket.done` event (only
created / started / submitted in `.ycm-harness/events.jsonl`). Product commit
`4a9be0d` is the submitted code. Do not treat harness `done` as parent-goal
done.

## Debate round 1

Independent first pass. `artifacts/review-tech_lead-ticket-add-ctrl-f-find-on-the-prerequisite-map-6ba0b9a3.md` was not present; no tech_lead findings to concede or rebut.
