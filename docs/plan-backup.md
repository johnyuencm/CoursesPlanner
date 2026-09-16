# Plan backups

Use **Download backup** in Build My Plan to save the current in-memory plan as a version-1 JSON file when browser storage is healthy. This is separate from the “Saved on this device” indicator.

When saving is **blocked** because the stored plan is unreadable, Download does not export the empty on-screen fallback. It either saves a recovery copy of the raw stored value (`course-plan-storage-recovery.txt`) with a warning, or refuses if that value is unavailable.

Use **Restore backup** to select a JSON backup. The planner validates the file before asking for confirmation. Confirming replaces the local plan; cancelling, invalid files, files larger than 1 MB, and storage write failures leave the current plan unchanged.

When the catalog is unavailable, the semester board is hidden. Restore stays disabled until the current plan summary is visible and you explicitly acknowledge replacing it.

Backups preserve completed courses and credits, waivers, every semester (including empty and co-op semesters), and course codes that are not in the current catalog. Restoring a backup writes it to browser storage before it replaces the plan visible in the app.
