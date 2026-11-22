---
reviewed_head_sha: 458dbe18f1d90e7e11c13da6f839442850e4aca4
ticket: 110
role: user_advocate
verdict: PASS
---

# User-advocate review, issue 110 (static 404)

Verdict: PASS. No high findings. Two low, one medium-low note.

Live behavior: NOT run by me. I read `lib/not-found.ts`, `worker.ts`, `app/global-not-found.tsx`, `app/globals.css` and `artifacts/local-check-110.txt`. The implementer's local check shows 404 and 481 bytes for unknown program and course paths. I did not repeat it. No app-UI stress walk run: the change has no app screen, only one static error page. `designing-ux-mechanics` stress-walk: NOT TESTED (reason: static HTML, no interactive mechanics beyond one link).

## Visitor experience
- Message and recovery: same words as `global-not-found`. One link to `/` ("Pick a college and program"). Recovery path is clear. PASS.
- Mobile: viewport meta present, `max-width:36rem`, `padding:0 1rem`. No fixed width. PASS.
- A11y: `lang="en"`, one `h1`, `main` landmark, real `<a>`, title set. Default link color gives AA contrast on white. Keyboard works. PASS.
- Visual (low): the static page skips `globals.css`. It shows the browser default serif font and default heading size. The styled 404 uses the app font and colors. A visitor sees a plainer page. Words match, so the job (get back) is done.
- Visual (low): the page has no `color-scheme` meta. Matches the light-only app (`color-scheme: light`). No issue.

## Behavior notes
- (medium-low) `cache-control: public, max-age=300`. After a deploy adds a course page, a visitor who saw a 404 for it sees the stale 404 for up to 5 minutes. The deploy doc states this. Accept: low traffic, rare event. No user action can clear it except waiting or hard reload.
- Edge: `/nothing` (a route miss) still shows the styled page. Two 404 looks exist. Visible only if a visitor compares them. Low.

## Operator value
- `docs/deploy.md` gives pass numbers (unknown-course 404 p50 6 ms or lower, course page 4 ms or lower) and the `wrangler tail` steps (40 warm rounds). The owner can measure live after deploy. PASS.
- Live CPU is not measured yet. The doc says so honestly. Issue #110 stays open until the owner records the numbers. Do not claim the 6 ms target met before then.
- Risk to the goal: the static string removes render cost. A p50 near 1 ms is likely, but this is unproven.

## Shneiderman (short)
Consistency: same words as styled 404, look differs (low). Shortcuts: n/a. Feedback: clear title and status 404. Closure: link home. Error handling: tells what is wrong and how to leave. Reversal: browser back works. Locus of control: no prompts. Memory load: one link, no state.

## Findings
| Sev | Item |
|---|---|
| medium-low | 5 min stale 404 after deploy (documented) |
| low | unstyled serif page vs styled global-not-found |
| low | two 404 looks (static vs route-miss) |
