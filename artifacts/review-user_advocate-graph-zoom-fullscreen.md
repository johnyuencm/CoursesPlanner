# User advocate review: graph zoom, fullscreen, and mobile scrolling

Verdict: **PASS for source-reviewed usability; live browser behavior UNVERIFIED.**

Reviewed `2931499..361683a` after the tech lead and project manager both settled on PASS. No product files changed. Root reports 82 tests, typecheck, and production build passing on the final implementation. This review did not repeat those gates. CUA and node_repl could not start (OS error 3), so no phone gestures, rendered viewport measurements, contrast measurements, or native fullscreen interactions were exercised.

ack_zero_findings_reason: The inspected controls directly support readable exploration, reversible course navigation, explicit relationship inspection, and small-screen scrolling without introducing a demonstrated usability blocker.

## Job to be done and discoverability

Users can locate a course without returning to Entire program: the persistent search searches beyond the current view and selecting a result follows that course's chain. Back/forward navigation and direct prerequisite/unlock links support backtracking (`components/course-graph.tsx:325,406,464,541`). The persistent toolbar exposes zoom buttons, the actual percentage, 100%, Fit, and Full screen; these controls are outside the Map/Table conditional (`components/course-graph.tsx:483`). Course and relationship selection retain explicit text feedback instead of relying exclusively on line color.

The mobile changes address the identified gesture restriction at the actual native-scroll surface (`app/globals.css:375,379`). Heading children, search, select, and topbar utilities are constrained to available width; controls wrap and key toolbar controls have 44px minimum touch targets (`app/globals.css:372,653,695`). This supports the reported phone task by inspection, but is not a substitute for actual 320–430px rendering and finger-scroll verification.

On narrow or short fullscreen screens, the map retains a readable scrollable height and the inspector joins the outer scrolling stack. A fixed, safe-area-aware Exit remains available while scrolling (`app/globals.css:730`). This is a reasonable source-visible trade-off for limited screen space. Search remains reachable at the top of that stack.

## Interaction design: eight Shneiderman rules

| Rule | Assessment |
| --- | --- |
| Consistency | Existing button, segmented-control, search, and inspector patterns are retained; Map/Table share one toolbar. |
| Shortcuts for frequent users | Ctrl/Meta+F, Enter/Shift+Enter and arrow-key search navigation remain available; Fit and 100% are one-action controls. |
| Informative feedback | Zoom percentage is live-announced; selected course, visible counts and selected relationship have status text; fullscreen entry changes the label to Exit full screen. |
| Closure | Selecting a course produces its chain and inspector content; selecting a relationship displays its named endpoints and catalog rule. |
| Simple error handling | Fullscreen rejection gives an actionable alternative: continue zooming and scrolling in place. Unsupported fullscreen is disabled with explanatory text; empty search offers a recovery hint. |
| Easy reversal | Course history, clear relationship selection, 100%, Fit, explicit fullscreen exit, and native fullscreen state synchronization give reversible navigation. |
| Internal locus of control | Readable scrolling remains the default; users explicitly choose zoom, Fit, scope, and fullscreen. Selecting another course does not require resetting program scope. |
| Reduced short-term memory load | The selected course, chain scope, visible relationships, full catalog rule and current zoom remain represented in the UI. Backtracking avoids remembering prior course codes. |

## Clarity, hierarchy, and accessibility

Search/navigation and display controls precede the map, while the inspector explains the selected relationship and course. Colors group destinations, but labels, endpoints, catalog-rule text, arrow direction, and pressed-state relationship buttons also communicate meaning (`components/course-graph.tsx:535`). Keyboard users have named native buttons, a skip-map link, search shortcuts, an alternate table, and text relationship controls; fullscreen exit restores focus (`components/course-graph.tsx:302`). Mobile toolbar targets are enlarged without shrinking the course cards. Rendered focus visibility, contrast, touch accuracy, and physical-device scroll behavior remain unverified.

## Findings and remaining evidence

No ranked finding is supported by the inspected implementation. The prior first-click Table-to-Fit and zoom-center defects were resolved before this review and accepted by both phase-1 reviewers. Completion reporting must retain the live-browser limitation: passing source review and unit/build gates does not establish that a phone was exercised end to end.
