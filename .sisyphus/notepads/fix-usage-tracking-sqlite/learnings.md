# Learnings - Fix Usage Tracking SQLite

## Conventions & Patterns
<!-- Agents append here as they discover coding conventions -->

## Task 3: Documentation Updates

### Pattern: Troubleshooting Section Format

- Main README.md uses table format with `problem | fix` columns
- Consistent style: lowercase problem description, concise fix
- Includes code examples in backticks
- Server README.md lacks troubleshooting section (only 39 lines)

### Pattern: SQLite Migration Documentation

- Added entry explaining OpenCode >= 1.2.0 SQLite change
- Included verification command: `opencode db path`
- Specified expected output format: `~/.local/share/opencode/opencode.db`
- Mentioned PATH requirement for `opencode` CLI
- Added instruction to restart backend server

### Key Information Conveyed

1. **Why**: OpenCode v1.2.0+ changed from JSON to SQLite storage
2. **What to check**: Run `opencode db path` to verify database location
3. **What to expect**: Valid database path output
4. **Prerequisite**: `opencode` CLI must be on PATH
5. **Action**: Restart backend server after verification

### Verification Approach

- Used `rg -n` to grep for specific command in documentation
- Captured full grep output to evidence file
- Confirmed 1 match in README.md at line 196

### Documentation Conventions

- Keep troubleshooting entries concise
- Include exact commands users can copy-paste
- Provide example output for clarity
- Link changes to upstream version requirements

---

*Last updated: Task 3 completion*

## Task 1: Backend Helper

- Implemented `queryOpencodeDB` in `server/index.js`.
- Uses `spawn('opencode', ['db', sql, '--format=json'])` for safe execution.
- Added timeout handling (10s) and error parsing.
- Verified with `SELECT 1 AS ok`.

## Task 2: Frontend Empty State Hint

- Implemented in `client-next/src/app/usage/page.tsx`.
- Used `@nsmr/pixelart-react` (`InfoBox` icon) instead of `lucide-react` (not installed).
- Leveraged `shadcn/ui` `Alert` component for concise message.
- Detected empty usage (`totalTokens === 0`) to trigger hint.
- Verified using Playwright by mocking `/api/usage` response with zero values.

## Task 4: SQLite Totals/Models/Projects

- `/api/usage` can aggregate totals with a bounded SQL result by grouping on `(project_id, modelID)` instead of scanning message rows.
- Safe time-window interpolation works by coercing `from/to` to finite non-negative numbers and embedding only truncated integers.
- Project filtering requirement can be met without SQL user input by filtering aggregate rows in JS (`row.projectId === projectId`).
- `json_extract` fallback order for model ID should handle multiple shapes: `$.modelID`, `$.model.modelID`, then `$.model.id`.
- Cost consistency now comes from token-based pricing (`input/output per 1M`) instead of relying on message `$.cost` presence.

## Task 5: SQLite-backed byDay Buckets

- Preserved legacy bucket formats while sourcing byDay from SQLite `message` table.
- Hourly bucket format must be exactly `YYYY-MM-DDTHH:00:00Z` (`strftime('%Y-%m-%dT%H:00:00Z', ...)`).
- Weekly buckets are safest when computed in JS from daily UTC dates to guarantee Monday-start output (`YYYY-MM-DD`).
- Frontend stacked usage bars require dynamic per-model keys in each bucket: `${modelID}_input` and `${modelID}_output`.
- Keeping `${modelID}` cost key in each bucket remains backward-compatible with existing payload shape.
- SQL pre-aggregation by `bucket + modelID + sessionID` reduces JS work and keeps chronological sorting stable.

## Task 6: Usage Endpoint Hardening

- Cache keys should include `debug` and `source` flags to avoid serving mismatched payload variants.
- `debug=1` diagnostics are useful for proving clamps/fallbacks (`min`, `max`, `clampedWindow`, `sourceUsed`, `errors`).
- Input parsing is safest with a helper that returns `null` for missing values and `NaN` for invalid numeric input.
- Source override behavior works cleanly with `source=auto|sqlite|legacy` and auto-only fallback to legacy on SQLite failure.

## Task 7: End-to-End QA and Evidence Capture

- Reliable 24h verification requires computing a single `from/to` pair once, then using the same window for both SQLite and `/api/usage` checks.
- SQLite aggregate parity check is stable when comparing against `assistant` role rows and summing `$.tokens.input + $.tokens.output`.
- `/api/usage` response shape validation should check top-level numeric totals and array types (`byModel`, `byDay`, `byProject`) plus minimal entry fields (`id`, `tokens`).
- Evidence artifacts are easiest to audit when split into expected (`task-7-expected.json`), actual (`task-7-actual.json`), and human-readable comparison (`task-7-diff.txt`).
