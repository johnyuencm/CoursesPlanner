# Project wiki schema

This wiki records reusable Course Planner decisions, root causes, and verification evidence.

- Durable pages live in `pages/`, with lowercase hyphenated Markdown filenames and stable page IDs.
- Record the goal, shipped behavior, verification, review, architecture decisions, and remaining limitations for implementation runs.
- Link related pages using `[[page-id]]`; distinguish executed checks from code inspection and unverified browser behavior.
- Use `ycm-harness wiki durable` to update pages and the generated index and activity log. Do not edit generated `index.md` or `log.md` by hand.
- Preserve any raw sources; exclude secrets, personal machine paths, and transient chat transcripts.
