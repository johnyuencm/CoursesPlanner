---
reviewed_head_sha: 8af8a69a9d86d00e7e33139353748883adbff8c8
---
# Review of PR 154 (fix #147, scroll place and focus on slow load)

Verdict: PASS. No defect found. No code change.

## Verify (on the PR head)
- `npm run typecheck`: exit 0.
- `npm test`: 372 pass, 0 fail (includes `tests/planner-load-focus.test.ts`).
- `npm run build`: exit 0 ("Build complete").

## Acceptance of #147
| Criterion | Result |
| --- | --- |
| Scroll place and focus kept when the board lands (390 px) | Met for focus: `PlanBackup keepFocus` focuses Download backup with `preventScroll` in a layout effect. The page text never jumped; scroll anchoring holds it. |
| CLS 0.1 or below | Met by the CSS change: only `html` clips sideways overflow at 860 px and below. The PR records live CLS 0.52-0.83 to 0 (`docs/reviews/2026-11-21-issue147-verification.md`). I did not repeat the live run. |
| A test or live check covers it | Met. A React render test checks focus after the board lands and in the first painted frame. A CSS test checks that no wrapper clips. |

## tech_lead and project_manager view
- `document.activeElement` is read in render only when `catalog` is set. The server render has no catalog, so SSR does not touch `document`.
- The `waiting` ref is null once the board mounts, so `keepFocus` is false on later renders. The effect runs once per change.
- The PR states its limits: CSS test finds only `overflow(-x): clip` with a space, no real phone or iOS Safari check, focus moves with no scroll.
- Independent of #152. Based on master.

## user_advocate view
- A keyboard user keeps focus on Download backup. A screen reader user still gets no "loaded" announcement. The PR tracks this in #153.
