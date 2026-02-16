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
