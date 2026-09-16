# user_advocate review — ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1

Verdict: **PASS** (no high findings; a student can finish the job live on `/map`)

Goal / job: double-click a course to enter that course's connections; Escape returns to the previous map view, including Entire program.
Reviewed state: branch `land/local-graph-focus`. Product commit `520fab8`. Reviewer is **not** the implementer. No product file was modified. The only file written is this artifact.

Phase 1 settled PASS with no high (`artifacts/review-tech_lead-ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1.md`, `artifacts/review-project_manager-ticket-double-click-enters-course-connections-escape-restores-p-aca8f5a1.md`). Live `/map` did not contradict their enter/pop wiring. This seat does not re-litigate architecture.

Live driver: `cursor-ide-browser` tab already on `http://localhost:3000/map` (viewId `8f1e86`). Viewport 1920×1080. Double-clicks used the snapshot `doubleClick` path on course cards. Escape used `browser_press_key` after focusing the empty map pane (not a dialog). Inspector restore used the visible **Return to previous view** button.

## How this was exercised — live

| Step | What happened |
| --- | --- |
| `/map` already Entire program | Show = **Entire program**. Course cards expose `Double-click to show this course's connections` in `aria-label`. Map pane focused. |
| Double-click **CS 5500** | Show → **This course's connections**. Status **Connections for CS 5500**. 4 courses / 5 unlock arrows (CS 5010, CS 5004, CS 5500, CS 6510). Inspector **CS 5500**. **Return to previous view** appears (`aria-keyshortcuts="Escape"`). **Show neighborhood** hidden (already on `"1"`). |
| Click empty map, then Escape | Show → **Entire program**. Status **Entire MSCS Seattle program**, 114 courses / 79 unlock arrows. Inspector stays **CS 5500**. Restore button gone. **Show neighborhood** returns. |
| Show → **This course's full chain** | Status **Course chain for CS 5010** (focusCode from the restored program snapshot), 7 courses. Inspector still CS 5500. Restore button absent. |
| Double-click **CS 6510** from that chain | Show → **This course's connections**. Status **Connections for CS 6510**. Inspector **CS 6510**. Restore button present. |
| Click empty map, then Escape | Show → **This course's full chain**. Status **Course chain for CS 5010**. Inspector stays **CS 6510**. Restore button gone. |
| Double-click **CS 5500**, click **Return to previous view** | Same restore as Escape: back to **This course's full chain**, 7-course CS 5010 chain, button gone. |
| Double-click **CS 5400**, open **Full course details**, Escape | Native `<dialog open>` stayed open; map **did not** pop (still Connections for CS 5400, restore still present). Synthetic key did not fire the dialog's native close; skip of restore is the product behavior that matters. Closed via **Close dialog**. |
| Header **Back** (Previous course) while still on CS 5400 connections | Map **stayed** on **This course's connections**. Restore button remained. Next-in-history enabled. |
| **Return to previous view** after that | Show → **This course's full chain** again. |

Canvas hint copy (DOM, not in the 1080px viewport): “Double-click a course to show its connections, then press Escape to return to the previous view.” `getBoundingClientRect` top **1073.4** / bottom **1117.9** vs `innerHeight` **1080** → `hintInView: false`. Style: `10.4px`, color `rgb(138, 147, 160)` on white.

## Re-check list (requested)

| Check | Live result |
| --- | --- |
| Entire program → double-click course → This course's connections | **met.** CS 5500 card; Show value `1`; status Connections for CS 5500. |
| Escape on the map (not a dialog) → Entire program | **met.** Empty `.flow-canvas` focused; Escape restored Entire MSCS Seattle program. |
| Same job from This course's full chain | **met.** CS 6510 / CS 5500 / CS 5400 drills; Escape or inspector button restored the chain (CS 5010), not Entire program. |
| Return to previous view in inspector | **met.** Appears only while `viewStack` is non-empty; click restores the stacked snapshot. `aria-keyshortcuts="Escape"`. |
| Discoverability of double-click and Escape | **weak, not blocking.** See UA-1. Screen readers get the card `aria-label`. Sighted users get a clipped muted hint plus the inspector button after they have already drilled in. |

## Shneiderman / interaction design

- **Consistency:** Show dropdown, status chip, and connections layout agree after drill-in. Page lede still says “Select a course to explore its connections” (`components/course-graph.tsx:459`) while the new path is double-click — mixed language, not a second nav system. Toolbar **Back** is previous *course*, inspector **Return to previous view** is previous *map* (UA-2).
- **Shortcuts for frequent users:** Double-click and Escape work. `aria-keyshortcuts="Escape"` on the restore button (`:619`). No visible Esc badge.
- **Informative feedback:** Immediate: Show value, “Connections for {code}”, course count, inspector heading, restore button appearing/disappearing.
- **Closure:** Drill-in is a completed view change; restore is a completed pop. Status counts confirm the map rebuilt.
- **Simple error handling:** No new error copy. Wrong control (header Back) does not trap; restore remains. Dialog skip leaves the student in the drawer (close control still there).
- **Easy reversal:** Escape and **Return to previous view** both pop. Show entire program remains as an explicit jump (clears the stack, per AC3).
- **Internal locus of control:** Student chooses the card; the map does not auto-drill. Escape is not stolen from the open details dialog (`dialog, [role='dialog']` at `lib/graph.ts:664-667`; live dialog stayed, map stayed).
- **Reduced short-term memory load:** Restore keeps `selectedCode` on the drilled course while the map returns to the previous focus (CS 6510 inspector on a CS 5010 chain). **Focus map here** appears when they diverge. Recoverable, extra thought.
- **Clarity / hierarchy:** Connections neighborhood is readable at 100%. Teaching copy for the new gesture is the least prominent text on the page (UA-1).
- **Accessibility:** Keyboard Escape works from the map pane. Cards announce double-click. Restore is a real button, not color-only. Hint is small muted text below the canvas; not the only exit once drilled in.

## Discoverability / errors / anti-patterns

- **Discoverability:** Double-click is not drawn on the card. The only sighted instruction is `.graph-canvas-hint` (`:587`), which was clipped off a 1080px window. After drill-in, Escape is mirrored by **Return to previous view**. Alternatives already in the chrome: Show → This course's connections; inspector **Show neighborhood**.
- **Error messages:** No failed double-click path. Empty find / no-match copy unused this pass.
- **Anti-patterns:** No silent failure on the happy path. No extra confirm. Header Back does not undo the view (UA-2). Not a trapped mode.

## Problem solved?

Yes. Live, double-clicking CS 5500 on Entire program entered This course's connections; Escape on the map restored Entire program. From This course's full chain, double-click entered that course's connections; Escape and the inspector button restored the chain.

## Findings

None high or medium.

- `low` UA-1 `components/course-graph.tsx:587,459,68,619`: Double-click and Escape are taught in a 10.4px muted hint that sat below the 1080px viewport (`hintInView: false`). The page description still says Select, not Double-click. Course cards only mention the gesture in `aria-label`. The restore button shows no visible Esc, only `aria-keyshortcuts`. Student can still finish via Show / Show neighborhood / the restore button. Not inaccessible primary flow.
- `low` UA-2 `components/course-graph.tsx:532,619`: Toolbar **Back** (Previous course) while on CS 5400 connections left Show on This course's connections; **Return to previous view** stayed. Two “back” controls. Recoverable because the labeled restore button remains.

## Verdict rationale

The stated job completed on the live map for Entire program and for This course's full chain. Escape on the map restored the previous view. The inspector restore button exists and works. Residual issues are discoverability and a second Back control — low, not blockers under the high bar (cannot complete, data loss, trapped mode, inaccessible primary flow).
