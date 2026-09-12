# CoursesPlanner run-record schema

This standalone wiki records verified implementation decisions and operational facts for future work.

- `raw/`: immutable run evidence.
- `wiki/`: compiled run pages, `index.md`, and append-only `log.md`.
- Use lowercase hyphenated filenames and `[[page-name]]` links.
- Each run page records Goal, Shipped, Verify, Review, Architecture, and Leftovers, with source paths.
- Read this schema, the index, and recent log entries before updates. Every run updates the index and appends a dated log entry. Preserve raw evidence and name unverified claims.

User instruction, 2026-09-11: always perform implementation in a new Git worktree. Preserve the original workspace and its existing edits.
