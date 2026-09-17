# User-advocate review — ticket-crawl-resumable-program-roadmaps-25be36b4

Verdict: PASS

Range: `1d82031..ffb19f3`, branch `goal/multi-university-roadmaps`. Surface is CLI (`catalog-service/cli.ts`) + read-only HTTP JSON API (`catalog-service/server.ts`); no GUI/TUI.

## Live behavior exercised (read-only, no crawl)

- `npx tsx catalog-service/cli.ts --list-universities` — returns ordered directory with per-university `status`; northeastern `status=queued, discoveryStatus=ready, counts.queued=1340`.
- `--list-programs --university=northeastern` — returns 1340 queued programs (518KB payload).
- Server on 8899: `GET /health` ok; `GET /universities/northeastern/status` returns queued status; `GET /universities/nope/programs` -> 404 `Unknown university: nope`; `POST /universities` -> 405 with `Allow: GET`; `GET .../roadmaps/does-not-exist` -> 404; `GET .../roadmaps/<queued-id>` -> 503 `Roadmap is not ready: <id> (queued)`; `GET /universities/mit/programs` -> 200 empty with `status=unverified`.
- Could NOT live-test `readReadyRoadmap` happy path: local persisted data has `ready:0` (no `roadmaps/` dir). Its validation sibling is unit-tested; happy path unexercised end-to-end by me.

## Findings

- low — no `--help`/`-h`: `npx tsx catalog-service/cli.ts --help` -> `Unknown or invalid catalog option: --help` (`cli.ts:26-27`). First-instinct discoverability fails and the error does not enumerate valid commands or point to the README. README (`README.md:74-86`) does document everything, so operator can recover.
- low — silent no-op crawl: `--crawl-roadmaps --limit=1 --university=mit` returns `{"processed":[]}` with no indication that mit is unverified/disabled, so nothing was fetched (`roadmaps.ts:168,175-196`). Operator believes a crawl ran when it did not. README states the supported+enabled+crawl precondition, but the CLI gives no feedback.
- low — crawl output hides failure reason: `processed` entries carry only `{universityId,type,status}` (`roadmaps.ts:320`, `cli.ts:46`); an `error` step shows no `reason`. Operator must run `--list-programs`/status separately to see it. Status summary does say "use --retry-errors", so recovery path exists.
- low — `GET /universities` inlines each crawlable university's full `queue` array (1340 IDs / ~66KB for northeastern) into the directory listing (`roadmaps.ts:119-122`, `summarize` at 59-77). Correct and read-only, but a directory listing is heavy and not human-scannable.

No high or medium findings. Error messages elsewhere are specific and recoverable (404 vs 503 vs 405+Allow distinguished correctly); JSON output is machine-parseable with no color-only information, so TTY usability holds. README's "Never run an unbounded crawl" note and `--limit=<1..100>` requirement are honest and discoverable.

## Shneiderman / interaction notes (short)

CLI+JSON service, not an interactive app. Consistency: one JSON envelope per command; shortcuts: none beyond flags (fine for a service); informative feedback: yes except the silent no-op; closure: `processed`/status confirms each step; simple error handling: clear messages; easy reversal: resume is idempotent, `--retry-errors` requeues; locus of control: bounded `--limit` puts the operator in charge; short-term memory: status/queue persisted so no in-head state.
