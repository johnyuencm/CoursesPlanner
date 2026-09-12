# Plan backups

Use **Download backup** in Build My Plan to save the current in-memory plan as a version-1 JSON file. This works even when browser storage is unavailable, and is separate from the “Saved on this device” indicator.

Use **Restore backup** to select a JSON backup. The planner validates the file before asking for confirmation. Confirming replaces the local plan; cancelling, invalid files, files larger than 1 MB, and storage write failures leave the current plan unchanged.

Backups preserve completed courses and credits, waivers, every semester (including empty and co-op semesters), and course codes that are not in the current catalog. Restoring a backup writes it to browser storage before it replaces the plan visible in the app.
