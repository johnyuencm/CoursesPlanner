# Review: PR #122 at 6c2b967

Diff: `f8ad949..6c2b967`, without `artifacts/`. Reviewer: independent.

**Verdict: FAIL** (2 medium findings on undo safety and access. No high finding.)

## Findings

| id | severity | file:line | issue | suggested fix |
|----|----------|-----------|-------|---------------|
| F1 | medium | components/app-provider.tsx:384, components/app-shell.tsx:127 | "Mark completed" and "Mark waived" run inside the course dialog. The toast with Undo is outside the modal `<dialog>`, so it is inert and under the backdrop. Browser check: `elementFromPoint` on Undo hits `footer.modal-footer`, and `focus()` fails. The timer runs (hover pause cannot fire). The dialog's own "Undo completion" does not put the course back in its planned semester, so the only full undo cannot be reached. | Render the toast inside the open dialog (or in the top layer, for example a `popover`), or put the Undo action in the dialog. |
| F2 | medium | components/app-provider.tsx:322, components/app-shell.tsx:94, components/app-shell.tsx:118 | `confirm()` removal makes "Reset local plan" a one-click destructive action. Undo lives only in a toast that goes after 10 s, goes when any later `announce` replaces it, and goes on tab close. Keyboard and screen reader users must tab to the end of the DOM to reach it; focus does not move there (WCAG 2.2.1). The banner reset overwrites unreadable stored data in localStorage at once. When Undo is lost, that raw data is gone for good. Restore backup has the same exposure. | Keep a confirm step for whole-plan reset (an in-page confirm, not `window.confirm`), or keep the reset undo until the user dismisses it. Do not auto-dismiss toasts that have an action, and give Undo a keyboard path (move focus, or a shortcut). |
| F3 | low | components/app-shell.tsx:109 | `dismiss={() => app.announce("")}` is a new function on each render. The Toast timer effect depends on it, so each context change restarts the 6 s / 10 s timer. A toast can stay much longer than stated. | Pass `app.announce` and call `announce("")` in Toast, or wrap `dismiss` in `useCallback`. |
| F4 | low | components/app-shell.tsx:121 | A new notice sets `paused` to false while the pointer or focus is still on the toast. The new toast then auto-dismisses under the pointer. | Reset `paused` only when the pointer and focus are not inside the toast (check `:hover` / `contains(document.activeElement)`). |
| F5 | low | components/app-shell.tsx:127 | After Undo, the toast is re-keyed, so the focused Undo button is removed. Focus falls to `<body>`. | Keep focus in the toast (focus its Dismiss button), or send focus back to the control that started the action. |
| F6 | low | components/roadmap-selector.tsx:86 | `open={... \|\| undefined}` is half controlled. After "Back to the current program", `open` changes to `undefined`, React removes the attribute, and the panel closes under the user. The `h2` title is now a `span` in `summary`, so heading navigation loses it. | Track `open` in state with `onToggle`, and force it open only on error. Keep a heading element inside `summary`. |
| F7 | low | components/pathways-workspace.tsx:50 | Copy starts a sentence with lower case: "Pick a persona. core, recommended and ...". | Use "Core, recommended and ...". |

## Checked and found correct

- `useBackCloses`: one entry per dialog; detail to picker swap reuses the entry; StrictMode double effect is safe (second mount replaces, first timeout sees a new token).
- Browser check on vinext dev (port 3017): open + X close, open + Back, and "View dependency graph" Link from inside the dialog. All kept `history.length` stable. Back from Explore returned to Courses in one press. No extra entry, no page exit.
- The overlay state spreads vinext metadata, so vinext treats the write as app-owned and the entry shares `__vinext_historyIndex` with the page. Popstate takes the same-route "commit without navigation" path. No defect seen.
- Blocked-storage reset and Undo: browser check with corrupt stored text. Reset wrote an empty plan; Undo wrote the exact raw text back and re-blocked saving. No double save.
- Handler identity (CR8): new handlers read state through `snapshotRef`; deps are stable. No data, auth or payment logic change found. `lib/pathway-overlay.ts` changes labels only; its test is updated.
- `key={pathname}` route wrapper: page segments remount on pathname change already; `?q=` search does not change `pathname`. No lost state found.

## Round 1 fixes (author response)

| id | Fix | Evidence |
|---|---|---|
| F1 | The toast renders inside the open modal dialog (portal), so Undo is not inert. The dialog button is renamed "Clear completion" / "Clear waiver", so "Undo" means only the toast. | Walk: Mark completed in the drawer, toast in the dialog, Undo restores status. `ux-review-2026-11-08/after-desktop-undo-in-dialog.png` |
| F2 | "Reset local plan" and "Reset saved plan" use `ConfirmButton`: an in-place second step, Escape cancels and returns focus. A toast with an action no longer auto-dismisses. | Walk: Undo toast still present after 7 s; armed button gets focus; Escape restores focus to "Reset local plan". |
| F3 | `dismiss` is a `useCallback` on the stable `announce`. | Code. |
| F4 | `paused` follows refs for hover and focus, so a new toast under the pointer stays paused. | Code. |
| F5 | After Undo, focus moves to the confirming toast's Dismiss button. | Walk: `document.activeElement` is "Dismiss notification". |
| F6 | The panel `open` is state with `onToggle`; it opens itself when a roadmap is chosen or a load fails. The title is an `h2` in `summary`. | Walk: summary click opens; one `h2`. |
| F7 | "Core, recommended and ..." | Code. |

## Round 2

Head: `1a2cf21`. Fix diff: `6c2b967..1a2cf21`, without `artifacts/`. Full PR diff skimmed: `f8ad949..1a2cf21`. Reviewer: independent.

**Verdict: FAIL** (3 medium findings: R1, R2, R3. All come from the round 1 toast changes.)

Evidence: vinext dev at `1a2cf21` on port 3017, Playwright, own browser context, 1280x800 and 390x800. `npm test` (335 pass) and `npm run typecheck` pass in the worktree.

### Round 1 findings

| id | status | note |
|----|--------|------|
| F1 | resolved | In one open dialog, Undo is in the dialog, `elementFromPoint` hits Undo, and Undo works. A dialog swap loses the toast (R1). The toast can cover the drawer footer (R2). |
| F2 | resolved | Both whole-plan resets need a second step. Action toasts stay until dismissed or replaced. A stale Undo is now a risk (R3). |
| F3 | resolved | `dismissNotice` is a `useCallback` on the stable `announce`. |
| F4 | resolved | A new toast under the pointer stays paused. One focus edge case remains (R4). |
| F5 | resolved | After Undo, focus goes to the Dismiss button of the new toast. |
| F6 | resolved | Browser: summary click and Enter toggle the panel. A user close stays closed after a roadmap is chosen. "Back to the current program" keeps the panel open. One `h2`. |
| F7 | resolved | Copy fixed. |

### New findings

| id | severity | file:line | issue | fix |
|----|----------|-----------|-------|-----|
| R1 | medium | components/app-shell.tsx:128 | The host effect depends on `[overlayOpen, notice]`. A dialog swap keeps `overlayOpen` true, so the effect does not run again. The toast stays in the old dialog, which React then removes. Browser: open CS 5010, Mark completed, click the CS 5400 chip. The document has 0 `.announcement` nodes while CS 5400 is open. "Add to my plan" (detail to picker) gives the same result. The toast comes back only when the dialog closes. No React error. | Add the dialog identity to the deps, for example `app.detailCode` and `app.picker`. Or let `Modal` give its element to the toast through context or a callback ref. |
| R2 | medium | components/app-shell.tsx:152, app/globals.css:413 | In the drawer at desktop width, the fixed toast is on top of the drawer footer. The center of "Add to my plan" hits the Undo button (`elementFromPoint`; Playwright reports "toast-action intercepts pointer events"). Action toasts now stay, so a click on "Add to my plan" runs Undo. At 390 px the footer is clear. | In a dialog, show the toast in flow above the footer, or move it up by the footer height. |
| R3 | medium | components/app-provider.tsx:322, components/app-provider.tsx:384, components/planner-board.tsx:320 | Undo restores the full snapshot from the time of the action, and the toast no longer expires. Add term, rename term, term type, credits and term reorder do not announce, so the old Undo stays. Browser: reset the plan, add 2 semesters, wait 7 s, press Undo. Both new semesters are gone, and the message says only "Reset undone". | Remove the action when the plan changes after the toast. For example, store the plan of that moment in the notice and clear the action in an effect when `plan` is a different object. |
| R4 | low | components/app-shell.tsx:144 | When the toast has focus and moves between hosts (Escape closes the dialog while focus is on Undo), React removes the focused node. No blur event comes, so `inside.current.focus` stays true. Later toasts without an action do not hide. Browser: "CS 5010 is no longer marked completed or waived." is still there after 6.5 s. The same flow without focus hides it. | Reset `inside.current` when the host changes. Or check `toastRef.current?.contains(document.activeElement)` in `sync` and before the timer starts. |
| R5 | low | components/ui.tsx:105 | In the profile menu, "Reset the plan" closes the menu. The arm button is then hidden, so the focus return fails and focus goes to `<body>`. | After a confirm in the menu, focus the menu summary or the Undo button of the toast. |
| R6 | low | components/ui.tsx:93 | The armed state stays when the menu closes by an outside click. When the menu opens again, "Reset the plan" shows at once. | Disarm when focus leaves the group (`onBlur` with a `relatedTarget` check), or when the parent `<details>` closes. |

### Checked and found correct

- ConfirmButton keyboard: Enter and Space arm it, and focus goes to the confirm button. Escape 1 disarms, keeps the menu open and puts focus on "Reset local plan". Escape 2 closes the menu and puts focus on the summary. `stopPropagation` keeps the menu open. Cancel keeps the menu open (`data-keep-open`).
- Planner-board ConfirmButton: Space arms, Escape disarms, and focus goes back.
- Dialog close while a toast shows: the toast goes back inline and stays. No console error in any swap or close flow.
- Entrance animation: the toast moves about 20 px during the 220 ms `drawer-in` animation. It is not clipped. After the animation, its containing block is the viewport, so `overflow: hidden` does not clip it.
- `RoadmapSelectorView`: the new `useState` and `useEffect` are before the early `return null`. The hook order is stable.
- `tests/app-provider.test.ts` (CR8 handler identity) passes. No provider handler changed in round 1.
- Restore backup: choosing a file is a deliberate step. The restore toast has Undo. R3 applies to it too.

## Round 2 fixes (author response)

| id | Fix | Evidence |
|---|---|---|
| R1 | The toast host follows the open dialog key (`detailCode` or picker), so a swap moves the toast into the new dialog. | Walk: detail, Undo toast, Add to my plan: 1 toast, inside the "Add a course" dialog. |
| R2 | Inside a dialog the toast is in flow in `.modal-inner`, below the footer. It covers no dialog button. | Walk: toast top is below the footer bottom. `ux-review-2026-11-08/after-desktop-undo-in-dialog.png` |
| R3 | The provider counts plan changes. A plan Undo (`undoesPlanChange`) is withdrawn as soon as a later plan change renders. Paths Undo checks that the defaults are still on screen. | Walk: reset, Add semester: Undo is gone, the message stays. |
| R4 | On a host change the hover and focus flags reset; on a new toast the focus flag is read from `document.activeElement`. | Walk: focus in toast, Escape closes the dialog, a plain toast still hides after 6 s. |
| R5 | A confirmed reset moves focus to the toast's Undo (`focusAction`). | Walk: after confirm in the menu, `activeElement` is `toast-action`. |
| R6 | `ConfirmButton` disarms on a pointer press outside the group, or on Tab out. A press inside (also in Safari) still confirms. | Walk: arm, outside click, reopen menu: not armed. |

## Round 3

Head: `65f41ba`. Fix diff: `1a2cf21..65f41ba`, without `artifacts/`. Reviewer: independent.

**Verdict: PASS** (R1-R6 resolved. 2 new low findings. No high or medium finding.)

Evidence: vinext dev on port 3101 (main checkout at `65f41ba`), Playwright, own browser context, 1280x800 and 400x800. `npm test` (335 pass) in the clean worktree.

### Round 2 findings

| id | status | note |
|----|--------|------|
| R1 | resolved | Browser: Mark completed in CS 5010, click the CS 5400 chip: 1 toast, in the CS 5400 dialog, Undo present. "Add to my plan" (detail to picker): 1 toast, in the "Add a course" dialog. Escape: the toast goes back to the page with Undo. No console error. Only one dialog can be open (`openPicker` clears `detailCode`), so the `overlay` key covers all swaps. |
| R2 | resolved | 1280 px drawer: footer 665-729, toast 729-800. 400 px drawer: footer 582-710, toast 710-800. The modal body shrinks and scrolls. `elementFromPoint` hits every footer button and the Undo button. Picker modal: toast is below the footer, the dialog grows. |
| R3 | resolved | Browser: reset, wait 7 s, Undo is still there and brings back all terms. Reset, then Add semester: Undo is removed, the message stays. Cross-tab: reset in tab A, Add semester in tab B: the storage event removes the Undo in tab A. Remove course and Mark completed on the board: Undo stays (no early withdrawal) and works. The Paths guard has a gap after a route change (N1). |
| R4 | resolved | The host effect resets `inside`. The notice effect reads `document.activeElement`. |
| R5 | resolved | Browser: confirm in the profile menu, `activeElement` is `toast-action`. |
| R6 | resolved | Browser: arm, click outside, open the menu again: not armed. Keyboard: arm, Tab out: not armed. Escape and Cancel still return focus to the arm button. |

### planVersion analysis

- Each `setPlan` call site makes a new object, so every undoable action makes exactly 1 identity change. Two renders of the same plan do not count twice, because the ref compares identity. No undoable action has a no-op `setPlan` now.
- StrictMode: the second render sees the same `plan`, so no double count. vinext app router dev does not use StrictMode, so this is code analysis only.
- Concurrent renders: the count only goes up. A discarded render could only add a count if it saw a plan that never commits. No `setPlan` runs in a transition, so this cannot happen now. If it did, Undo would go early (safe side), not late.
- Cross-tab and program change: both change `plan`, so Undo is withdrawn. This is correct (Undo must not overwrite the other tab or another program).
- CR8: `liveNotice` is a `useMemo` on `[notice, stale]`. `tests/app-provider.test.ts` passes.

### New findings

| id | severity | file:line | issue | fix |
|----|----------|-----------|-------|-----|
| N1 | low | components/pathways-workspace.tsx:118 | The guard reads `pathwaysRef` of the instance that did the reset. The Undo toast stays across routes. After Paths, Plan, Paths, the old instance is unmounted, its ref still equals `defaults`, so Undo goes on. It writes the old suggestions to storage, but `setPathways` goes to the dead instance. Browser: the toast says "Your earlier suggestions are back.", the screen still shows the defaults, and only a reload shows "Custom Robotics". If the user edits the new screen without a save, Undo also says "back" while the screen shows the edits. No data is lost. | Track mount in a ref (`useEffect(() => () => { mounted.current = false }, [])`) and refuse Undo when unmounted. Or clear the notice in that cleanup when it is this reset notice. |
| N2 | low | components/app-provider.tsx:513, components/app-shell.tsx:140 | After a confirmed reset, focus is on Undo (`focusAction`). A plan change from another tab removes the Undo button, and focus falls to `<body>`. Browser: `activeElement` is `BODY` after the tab B change. Same tab cannot hit this, because a click moves focus first. | When `stale` removes the action and focus was in the toast, focus the Dismiss button (the R5 `dismissRef` path). |

### Checked and found correct

- Toast in the drawer, 400 px and 1280 px: in flow, full width, `.modal-inner` does not overflow, no horizontal scroll from the toast. The drawer at 400 px starts 15 px off the left edge because `width: 100vw` includes the classic scrollbar. This comes from the drawer CSS, not from this diff.
- Focus: the toast is inside the native modal `dialog`, so Tab reaches Undo. No custom focus trap to update.
- `ConfirmButton`: a pointer press inside the group does not disarm. `onBlur` needs a `relatedTarget`, so the Safari null-blur on press does not drop the confirm.
- A withdrawn Undo gives a plain toast, which hides after 6 s.

## Round 3 fixes (author response)

| id | Fix | Evidence |
|---|---|---|
| N1 | `announce` returns the toast id. Paths withdraws its reset toast when the page unmounts, so Undo never acts on a page that is gone. | Walk: reset on Paths, go to Plan: 0 toasts. |
| N2 | When Undo is withdrawn while it has focus, focus moves to the toast's Dismiss button. | Code (needs two tabs to reproduce). |
| Drawer | Drawer width uses `100%` of the viewport box, not `100vw`, so the scrollbar does not push it off the edge. | Walk at 400 px: drawer left 0, right 400. |
