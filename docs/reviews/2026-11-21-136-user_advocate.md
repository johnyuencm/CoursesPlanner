---
reviewed_head_sha: ef988298480aa3285c74425a7c2354b544540285
verdict: PASS
---

# User advocate review: #136 roadmap read errors

- Branch: `fix/136-roadmap-read-errors`. Diff: `git diff origin/master...ef98829`.
- Seat: user_advocate (last seat). I did not write this code. I did not change product files.
- Phase 1: `docs/reviews/2026-11-21-136-tech_lead.md` (PASS) and
  `docs/reviews/2026-11-21-136-project_manager.md` (PASS). I do not re-open their findings.
- Follow-up issue: #151 (selector "Queued" text and `invalid-programs` kind).

## Verdict

PASS. The developer now gets the true cause on every surface that I ran.
No high or medium finding. Three low findings.

## User and job

- User: a developer who runs the app with local crawl output under `data/catalogs/`.
- Job: when local data is broken, see the true cause and fix the right file fast.

## Live check (what I ran)

I used a scratch git worktree at `ef98829` (`.worktrees/ua-136`). I moved
`data/catalogs/northeastern/programs.json` away there only. I removed the
worktree after the check. The main checkout did not change.

```
programs.json missing
      |
      +--> CLI  --roadmap        -> "Program list is missing: data/catalogs/northeastern/programs.json"  exit 1
      +--> npm run build         -> "Published snapshot northeastern/<id> is missing or invalid:
      |                               Program list is missing: data/catalogs/northeastern/programs.json"  exit 1
      +--> /api/roadmaps         -> 404 {"error":"The program list (programs.json) is missing."}
      +--> catalog service       -> 404 same body (route and service agree)
      +--> /api/roadmaps list    -> 200, programs [], status "queued"   (not changed; #151)
```

| Surface | Before (origin/master) | After (ef98829) | True? |
|---|---|---|---|
| CLI `--roadmap=<ready id> --university=northeastern` | `Unknown roadmap program: computer-science-mscs-align-a4f8db6b17` | `Program list is missing: data/catalogs/northeastern/programs.json`, exit 1 | yes |
| `npm run build` | wrapped "Unknown roadmap program" (#127) | wrapped text that names the file path, exit 1 | yes |
| Route, ready id | 404 "Unknown roadmap program." | 404 "The program list (programs.json) is missing." | yes |
| Route, unknown id `nope` | 404 "Unknown roadmap program." | 404 "The program list (programs.json) is missing." | yes (the reader cannot know the id without the file) |
| Route, unknown university `zzz` | 404 "Unknown university." | 404 "Unknown university." | yes, no change |
| Catalog service, same 4 cases | long `error.message` | same status and body as the route | yes |

Not run live:

- `npm start` (wrangler dev on port 3000). The build fails when `programs.json`
  is missing, so this state cannot reach `wrangler dev`. With the file present,
  the changed texts do not show. Thus a wrangler run adds no evidence here.
- The browser UI. The selector is hidden in this state today
  (project_manager check of `lib/roadmaps.ts:29-31`). Thus no UI reader sees the
  new text today.

## Judgment of each new text

| Text | Truth | Actionable | Plain language |
|---|---|---|---|
| "The program list (programs.json) is missing." | True. | Names the file. Does not name the folder. The request URL holds the university id, so the developer can find `data/catalogs/<id>/`. | Good. One idea. |
| "Program list is missing: data/catalogs/<id>/programs.json" | True. | Best of the set. It gives the exact path to restore or re-crawl. | Good. |
| "Roadmap is not ready yet." | True. Text not changed. | Same as before. | Good. |
| "Unknown roadmap program." | True now. Before, it was false when the file was missing. | Same as before. | Good. |

## Existing readers of changed bodies

- `components/roadmap-selector.tsx:21-24` reads only `data.error` as a string.
  It shows that text. All new bodies keep `{ error: string }`. No break.
- Catalog service bodies for known kinds changed from the long message to the
  short text. A developer who called the service directly lost the request id
  in the body. The id is in the URL that they sent. No reader in the repo
  parses the old long text (phase 1 checked the callers).
- CLI and build text did not change for old kinds. Only the missing-file case
  has a new text, and that is the fix.

## Findings

| Severity | Finding | Evidence |
|---|---|---|
| low | The HTTP text does not name the university folder, and known kinds write no server log line. A developer who sees only the 404 body must use the request URL to find `data/catalogs/<id>/programs.json`. The CLI and the build give the full path. Not a regression: before, this case also wrote no log. | `app/api/roadmaps/route.ts:34`, `lib/roadmap-reader.ts:24` |
| low | The build prefix says "is missing or invalid", and names a published snapshot (`computer-science-mscs-sea-...`). The real cause is the shared program list. The tail of the line gives the true cause and path, so a developer still fixes the right file. | `lib/snapshot-manifest.ts:76`; live build output |
| low | The program list endpoint still answers 200 with `status: "queued"` when the file is missing. This conflicts with the 404 "missing" text on the roadmap endpoint for the same state. Already tracked in #151. Hidden in the UI today. | live `/api/roadmaps?university=northeastern` |

## Interaction design (CLI, HTTP error text)

There is no GUI change. The surfaces are CLI output, build output and HTTP
error bodies. `designing-ux-mechanics` stress walk does not apply: no app
screen changed.

| Rule | Note |
|---|---|
| Consistency | Route and catalog service now give the same status and body for each kind. One table holds all texts. |
| Shortcuts for frequent users | Not applicable. No new command or flag. |
| Informative feedback | Improved. The missing-file case now names the file. CLI gives the full path. |
| Closure | The CLI and the build exit 1 with one error line. Clear end state. |
| Simple error handling | The text points to the file to restore. It does not tell how to re-create it (re-crawl command). Acceptable for a dev-only state. |
| Easy reversal | Restore the file and run again. No state is written. |
| Internal locus of control | No prompts. No hidden retries. |
| Short-term memory load | One line per error. The path is in the line, so the user need not remember the layout. |
| Clarity and hierarchy | Short sentences. No jargon except the file name, which is the point. |
| Accessibility | Plain text. No color-only signal. Works in any TTY. |

## Problem solved?

Yes. The #127 false message ("Unknown roadmap program" for a lost file) is gone
on the CLI, the build, the route and the catalog service. The developer now
fixes the file, not the program id.
