# User-advocate review — ticket-select-university-roadmaps-on-graph-1a5c1c70

Range `236738f..fb1642a`, branch `goal/multi-university-roadmaps`. Independent of tech_lead/project_manager; verdict below is my own.

## Verdict

PASS — no high findings. The feature ships, the default Northeastern MSCS graph is preserved, and the roadmap flow works end to end for a ready program (proven by `tests/roadmaps-route.test.ts:181-190`; I could not render the React component in a browser, so UI findings are from code + live API only).

## Live evidence (what I actually ran)

Direct invocation of the real route (`app/api/roadmaps/route.ts` `handleRoadmapsRequest`) against the worktree's real `catalog-service/universities.json` + `data/catalogs/northeastern/programs.json`:

- `GET /api/roadmaps` → 200, `cache-control: no-store`, US-first list of 40, each with a status object.
- `?university=northeastern` → 200, 1340 programs.
- `?university=northeastern&program=<queued-id>` → 503 `{"error":"Roadmap is not ready: … (queued)"}`.
- unknown university → 404; `..%2F..%2Fetc` → 400; `?program=foo` (no university) → 400; `Northeastern` (uppercase) → 400.

Ready-program happy path: no local ready roadmap exists (`data/catalogs/northeastern` has 0 ready). I reproduced the exact fixture the route test uses in a tmpdir; the ready read returns 200 with `programId`/`programCourseCodes`/`courses` (this is the same path `tests/roadmaps-route.test.ts` asserts). Component rendering (optgroup order, `disabled` attributes, reset button) was NOT exercised in a browser — no headless runner in this repo; I inspected `components/roadmap-selector.tsx` and `components/course-graph.tsx` instead.

## Findings

### Medium

- **M1 — stale async selector response race** (`components/roadmap-selector.tsx:51-91`). `selectUniversity`/`selectProgram` fire `fetch` with no AbortController or request token. Two concrete failures:
  1. Pick university A (slow), then B (fast): A resolves last → `setPrograms(A.programs)` while `universityId === B`; the dropdown shows A's programs under B, and choosing one requests `?university=B&program=<A-id>` → 404 "Unknown roadmap program".
  2. Pick a program, then click "Back to Northeastern MSCS" before the roadmap resolves: `onRoadmapChange(null)` fires, then the in-flight fetch resolves and calls `onRoadmapChange(data)`, re-showing the roadmap the user just cleared.
  Blocking decision: does NOT block user value (default NEU flow is unaffected; re-selecting the correct university recovers). Recoverable, so medium not high — but it is the most user-visible defect in the new flow.

- **M2 — program dropdown is a wall of disabled raw-slug options** (`components/roadmap-selector.tsx:136-144`, label `program.name ?? program.id`). Northeastern has 1340 discovered programs, all currently `queued` with `name === undefined`, so the `<select>` renders 1340 disabled options labelled with raw slugs like `global-doctoral-research-graduate-certificate-a4e438d122 · Queued`. When ready programs do appear they are sorted by `officialUrl` (`catalog-service/roadmaps.ts:99`) among these disabled entries — the primary "pick a ready program" action becomes a hunt through a ~1340-entry dropdown. No ready-first ordering or filter. Discoverability harm, not a correctness bug.

- **M3 — no retry after a fetch error locks the selector** (`components/roadmap-selector.tsx:116` `disabled={loading || Boolean(error)}`, `:136` `disabled={programsLoading || Boolean(programsError)}`). One transient failure of `/api/roadmaps` or the program list disables the select permanently with no retry affordance; the only recovery is a full page reload. The status region shows the error text but offers no action. (tech_lead/PM rated this low; I raise it because for the roadmap task the user is in-session stuck, though reload is an exit.)

### Low

- **L1 — error passthrough leaks internals** (`app/api/roadmaps/route.ts:59-65`). The catch returns raw `error.message`; a malformed snapshot or missing roadmap file surfaces validator labels / `ENOENT` filesystem paths to the browser (observed live: 503 body carried the raw validator message). Local-first single-user app, so low.
- **L2 — one-frame stale render on roadmap switch** (`components/course-graph.tsx:132-143`). The reset effect runs after paint, so the first render after selecting a roadmap still uses the old `focusCode`/`selectedCode` ("CS 5010"), producing a transient "Metadata not in this catalog" node/inspector if the roadmap's first code differs. Also omits `view` and `lineSemesterId` (view persisting is arguably fine; lineSemester is harmless since `selectedRelationship` is cleared).
- **L3 — status vocabulary unexplained.** "Unverified", "Unsupported", "Queued", "Unavailable" appear inline in every option with no legend; a first-time user cannot tell "Unverified" from "Unsupported", and disabled options are not tabbable so screen-reader users get the terms only from the status line.

## Interaction design (Shneiderman, one note each)

- Consistency: reuses existing `.button`/`.field-label`/`.muted`/`.status-pill` patterns; no new visual language. Good.
- Shortcuts: none for the selector (graph find keeps Ctrl+F). Acceptable — a two-dropdown control has no frequent-use path.
- Informative feedback: `role="status" aria-live="polite"` announces loading/error/ready-count; selections reflect immediately. Good, modulo M1/M3.
- Closure: "Showing the selected roadmap." + header `programLabel` + "Back to Northeastern MSCS" confirm state and offer an exit. Good.
- Simple error handling: sentences are plain, but M3 removes the recover action and L1 leaks raw text.
- Easy reversal: reset button reverses fully except M1 can re-apply a cleared roadmap.
- Internal locus of control: user drives every change; only the L2 first-frame reset is a surprise.
- Reduced short-term memory: statuses inline per option + ready count + program label; undermined by M2's 1340 raw-slug entries.

Accessibility: native `<label htmlFor>` + `<select>` (keyboard/focusable), `aria-label` on the section, live region for status; status is text + `disabled`, not color alone. Gaps: disabled options are skipped by keyboard/SR navigation, and M2's slug labels are low-clarity. Contrast and heading order inherit the existing design system (not restyled here).

## ack_zero_findings_reason

Not applicable — findings above are non-empty.
