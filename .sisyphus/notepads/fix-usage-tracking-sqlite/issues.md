# Issues & Gotchas - Fix Usage Tracking SQLite

## Problems Encountered
<!-- Agents append here when encountering issues or gotchas -->

## Task 5 Issue Noted

- Current endpoint can show `byDay` (SQLite) values that do not match `totalTokens` (legacy file scan) until totals/byModel/byProject are fully SQLite-backed. This is expected with task-scoped changes.

## Task 6 Issue Noted

- Evidence collection can accidentally hit stale code if an older backend process is still running; restart server before final capture.
