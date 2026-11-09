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
