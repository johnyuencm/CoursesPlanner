# Project manager review: graph zoom, fullscreen, and mobile scrolling

Verdict: **PASS** for inspected implementation; actual browser behavior remains **UNVERIFIED**.

Reviewed total diff `2931499..361683a`, including mobile fix `43c4874..361683a`, on 2026-09-15. This supersedes the earlier FAIL. No product files changed by this reviewer. Root independently reports 82 tests and typecheck passing; final build has compiled and is pending completion at review time. No redundant tests/build were run. CUA and node_repl fail runtime startup with OS error 3, so this review does not claim phone screenshots, live touch scrolling, or native fullscreen proof.

ack_zero_findings_reason: Every supplied criterion was traced through the current implementation; both prior defects have targeted fixes, and mobile changes address the identified touch and overflow mechanisms without changing course or relationship behavior.

## Criterion map

| Criterion | Status | Evidence and limits |
| --- | --- | --- |
| Zoom out/in, actual percentage, reset 100% | Met in code | `components/course-graph.tsx:483` renders bounded zoom controls, shared-state percentage, and reset. `components/graph-canvas.tsx:133` applies that scale. |
| Fit all displayed graph, including first click from Table | Met in code and unit coverage | Workspace acknowledgment survives unmount (`components/course-graph.tsx:104`); canvas measures actual client dimensions and consumes the pending request (`components/graph-canvas.tsx:104`). `tests/graph.test.ts:559` covers pending requests, zero-size deferral, and replay suppression. |
| Preserve center during zoom, including near scroll edges | Met in code and lifecycle-unit coverage | `components/graph-canvas.tsx:62` captures offsets before mutation; line 68 restores the calculated center afterward. `tests/graph-viewport.test.ts:6` invokes production lifecycle methods around simulated clamping. It is not a mounted browser test. |
| Reveal selected course at current scale | Met in code | `components/graph-canvas.tsx:111` maintains current zoom and line 114 reveals the selected card using scaled coordinates. |
| Course click isolates its chain and retains backtracking | Met in code | Node callback at `components/course-graph.tsx:178` calls locate; line 325 records navigation and sets course scope. Back/forward at lines 464–465 reuse that path. Mobile patch does not change these handlers. |
| Colored clickable relationships preserved | Met in code | `components/course-graph.tsx:240` retains branch/bus callbacks and colored marker/style construction; `components/graph-canvas.tsx:33` retains hit-region click handlers. |
| Readable native map scrolling | Met in code; touch behavior UNVERIFIED | Existing overflow scrolling remains at `app/globals.css:375`; line 378 overrides the actual vendor `.react-flow__pane { touch-action: none }` rule with `auto`. Canvas keeps library panning/zoom gestures disabled and `preventScrolling={false}` at `components/graph-canvas.tsx:136`. |
| Phone controls and search fit widths 320–430px | Met by CSS inspection; rendered fit UNVERIFIED | `app/globals.css:372` bounds heading children; line 697 makes search shrinkable and full width, lines 701–707 size touch controls and constrain selects. Toolbar wraps, and result/inspector text can break. |
| Phone topbar fits | Met by CSS inspection; rendered fit UNVERIFIED | `app/globals.css:653` gives utilities a bounded full-width row, permits target-select shrinking, and line 676 hides secondary profile text while preserving the profile control. |
| Fullscreen graph and inspector remain usable | Met in code; native/layout behavior UNVERIFIED | Desktop keeps independent canvas/table and inspector scroll areas (`app/globals.css:434`). Narrow or short screens intentionally use a scrolling stack at line 731, with a separately scrollable readable map. Inspector content scrolls with that stack instead of occupying a fixed small rail. |
| Short-landscape safe exit and Table access | Met in code; rendered behavior UNVERIFIED | Width <=860px OR height <=540px triggers stack layout (`app/globals.css:730`); line 736 fixes Exit above content with safe-area spacing. The button is outside the Map/Table conditional (`components/course-graph.tsx:489,504`); table height is bounded at CSS line 734. |
| Search accessible in fullscreen and Table | Met in code | Search remains in the fullscreen subtree before view branching (`components/course-graph.tsx:406`); a scrolling fullscreen stack makes the heading reachable on short screens. |
| Native Escape sync; unsupported/rejected fullscreen graceful | Met in code; browser behavior UNVERIFIED | `components/course-graph.tsx:302` listens to fullscreenchange and restores focus; line 359 handles entry/exit and catches rejection; unavailable entry is disabled with an explanation at line 495. |

## Resolution of prior findings

The first-click Table-to-Fit defect is resolved by moving acknowledgment ownership to the persistent workspace and reading mounted client dimensions. The zoom-out center defect is resolved by the narrow class lifecycle boundary, which captures the previous DOM viewport before dimensions shrink. Both fixes target the reported mechanisms; the added tests are honestly classified as unit tests.

The mobile pane override addresses the confirmed vendor CSS rule. The narrow/short fullscreen scrolling stack replaces the former fixed inspector row, which could consume map space and clip controls. A fixed Exit remains reachable during stack scrolling. This is an explicit responsive trade-off: desktop retains independently scrolling map and inspector, while phones scroll inspector content in the enclosing fullscreen stack.

## Scope and remaining evidence limits

The patch stays within graph controls, graph viewport behavior, responsive graph layout, and the reported phone topbar overflow. No dependency, data model, placeholder behavior, deleted test, or unrelated feature was introduced. Existing course focus, history, relationship selection, and keyboard controls remain present.

No outstanding code finding was identified. The fit helper retains its existing 5% floor; arbitrary huge graphs are not guaranteed to fit, but no current catalog evidence demonstrates a violation. Actual rendered 320–430px layouts, touch gestures, native Escape, fullscreen rejection, and short-landscape interaction remain UNVERIFIED because both available browser runtimes failed to start. Final completion reporting must retain that limitation and await the root's final build result.

## Debate record

Initial PM/tech agreement: Table-to-Fit and post-shrink center preservation required fixes. Tech round 2 independently accepted `43c4874`; this review also accepts those fixes. The subsequent mobile review addressed the pane touch restriction and short-screen layout risks, and the current verdict reflects the expanded acceptance criteria above.

