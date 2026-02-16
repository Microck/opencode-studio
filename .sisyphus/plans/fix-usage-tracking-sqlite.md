# Fix Studio Usage Tracking With OpenCode SQLite (v1.2+)

## TL;DR

> **Quick Summary**: OpenCode `>= 1.2.0` migrated usage data from legacy `storage/message/**.json` to SQLite (`opencode.db`). Studio’s `GET /api/usage` still scans JSON, so `/usage` shows zeros. Fix by switching `/api/usage` to query SQLite via `opencode db "<SQL>" --format=json` (no new Node deps) with a legacy JSON fallback.
>
> **Deliverables**:
> - Studio backend `/api/usage` returns correct non-zero totals on OpenCode `1.2.5` using SQLite.
> - Backwards compatible: if SQLite path/CLI fails, endpoint falls back to legacy JSON scan.
> - Clear troubleshooting signal (optional debug mode) and a friendlier `/usage` empty-state.
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES (2 waves)
> **Critical Path**: Add `opencode db` runner helper -> implement SQLite aggregation in `/api/usage` -> QA

---

## Context

### Original Request
Studio app is not tracking usage now that OpenCode has been updated.

### Confirmed Environment
- OpenCode version: `1.2.5`
- OpenCode DB path: `/Users/devbox/.local/share/opencode/opencode.db` (from `opencode db path`)
- Broken surface: Studio `/usage` dashboard (shows empty/0)

### Root Cause (confirmed by code + upstream change)
- Studio backend `GET /api/usage` (`server/index.js:4012`) only scans legacy JSON message storage at `<base>/storage/message/ses_*/**.json`.
- OpenCode `>= 1.2.0` stores sessions/messages in SQLite (`opencode.db`) and no longer necessarily writes those JSON files.

### Key Upstream References
- OpenCode `db` CLI command supports running a SQL query and returning JSON via `--format=json`:
  - https://raw.githubusercontent.com/anomalyco/opencode/8c1af9b445a45128d147f6f818dfd3ed7c4e75ef/packages/opencode/src/cli/cmd/db.ts
- OpenCode SQLite schema (tables `session`, `message`, `project`):
  - https://raw.githubusercontent.com/anomalyco/opencode/8c1af9b445a45128d147f6f818dfd3ed7c4e75ef/packages/opencode/src/session/session.sql.ts
  - https://raw.githubusercontent.com/anomalyco/opencode/8c1af9b445a45128d147f6f818dfd3ed7c4e75ef/packages/opencode/src/project/project.sql.ts
- Timestamp column names in DB (`time_created`, `time_updated`):
  - https://raw.githubusercontent.com/anomalyco/opencode/8c1af9b445a45128d147f6f818dfd3ed7c4e75ef/packages/opencode/src/storage/schema.sql.ts

---

## Work Objectives

### Core Objective
Restore correct `/usage` stats in OpenCode Studio for OpenCode `1.2.5` by reading usage data from SQLite instead of legacy JSON.

### Scope
- IN:
  - Update backend `GET /api/usage` to prefer SQLite `opencode.db` using `opencode db` query output.
  - Preserve response shape consumed by the frontend.
  - Maintain legacy JSON scan fallback.
  - Add minimal guardrails (timeouts, input validation, bounded output).
- OUT:
  - New analytics product features (alerts, forecasting, etc.).
  - Changing token semantics (keep legacy: input+output only).

### Definition Of Done
- `/usage` shows non-zero totals after generating a new OpenCode assistant message.
- `curl http://127.0.0.1:1920/api/usage?...` matches SQLite aggregates for the same window.
- If `opencode` is not on PATH (or query fails), Studio degrades gracefully (fallback to legacy JSON scan; if both unavailable, return zeros + clear error in debug).

---

## Verification Strategy (MANDATORY)

> ZERO HUMAN INTERVENTION. All verification is agent-executed with commands.

### Test Decision
- Infrastructure exists: NO (no Jest/Vitest/etc. scripts in `server/package.json` or root).
- Automated tests: None (do not add a test framework for this fix).
- Primary verification: Bash (curl + opencode CLI) QA scenarios with captured evidence.

### QA Evidence Policy
- Evidence files saved to `.sisyphus/evidence/`.
- Each task’s scenarios write at least:
  - one `curl` response JSON capture
  - one `opencode db` query JSON capture

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (can start immediately)
├── Task 1: Backend helper to run `opencode db` safely [quick]
├── Task 2: Frontend `/usage` empty-state troubleshooting hint [visual-engineering]
└── Task 3: Docs/troubleshooting update re: SQLite migration [writing]

Wave 2 (after Task 1)
├── Task 4: SQLite-backed totals + byModel + byProject aggregation [unspecified-high]
├── Task 5: SQLite-backed byDay bucketing (hourly/daily/weekly/monthly) [unspecified-high]
├── Task 6: Guardrails + fallback behavior + debug diagnostics [quick]
└── Task 7: End-to-end QA + evidence capture [unspecified-high]

Critical Path: Task 1 -> Task 4/5/6 -> Task 7

---

## Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 | - | 4,5,6,7 | 1 |
| 2 | - | - | 1 |
| 3 | - | - | 1 |
| 4 | 1 | 7 | 2 |
| 5 | 1 | 7 | 2 |
| 6 | 1 | 7 | 2 |
| 7 | 4,5,6 | - | 2 |

---

## TODOs

> Notes on semantics to preserve:
> - Keep legacy inclusion rules: only assistant messages; tokens = `input + output`; ignore reasoning/cache.
> - Keep response shape: `{ totalCost, totalTokens, byModel, byDay, byProject }`.

- [x] 1. Backend helper: resolve DB path + run `opencode db` queries safely

  **What to do**:
  - Add a small helper in `server/index.js` to:
    - Resolve database path (prefer `opencode db path`, fallback to known data roots + `opencode.db` existence).
    - Execute `opencode db "<SQL>" --format=json` via `child_process.spawn` (args array), not `exec`.
    - Enforce timeout (5-10s) and kill process on timeout.
    - Parse stdout as JSON; treat stderr as error signal.

  **Must NOT do**:
  - Must not accept raw SQL from HTTP requests.
  - Must not build a shell command string; avoid shell interpolation.

  **Recommended Agent Profile**:
  - Category: `quick`
    - Reason: Small focused backend plumbing change.
  - Skills: (none)

  **Parallelization**:
  - Can Run In Parallel: YES (with Tasks 2-3)
  - Blocks: 4, 5, 6, 7

  **References**:
  - `server/index.js:4012` - existing `/api/usage` endpoint to integrate with.
  - OpenCode CLI `db` command implementation (format flag):
    - https://raw.githubusercontent.com/anomalyco/opencode/8c1af9b445a45128d147f6f818dfd3ed7c4e75ef/packages/opencode/src/cli/cmd/db.ts

  **Acceptance Criteria**:
  - `opencode db path` execution is used (or equivalent) and failures are handled without crashing the server.
  - Helper returns structured error information usable by Task 6.

  **QA Scenarios**:
  ```
  Scenario: Helper can run a trivial query
    Tool: Bash
    Steps:
      1. Start server: `npm start` (repo root) OR `cd server && npm start`
      2. From another shell: run `opencode db "SELECT 1 AS ok" --format=json > .sisyphus/evidence/task-1-opencode-db-select-1.json`
      3. Assert `.sisyphus/evidence/task-1-opencode-db-select-1.json` parses as JSON and contains `[{"ok":1}]`
    Evidence: .sisyphus/evidence/task-1-opencode-db-select-1.json

  Scenario: Helper times out and returns error cleanly
    Tool: Bash
    Steps:
      1. Force a short timeout (env or hardcoded during dev)
      2. Run a purposely slow query (or simulate by pointing to invalid binary)
      3. Assert server stays up and returns a structured error (no crash)
    Evidence: .sisyphus/evidence/task-1-timeout-error.txt
  ```

- [x] 2. Frontend: friendlier `/usage` empty-state + troubleshooting hint

  **What to do**:
  - In `client-next/src/app/usage/page.tsx`, when `stats.totalTokens === 0` (and not loading), show a short hint:
    - “If you recently updated OpenCode: usage now comes from SQLite; ensure backend can run `opencode db path`.”
  - Keep the existing layout; do not redesign charts.

  **Must NOT do**:
  - Don’t add new settings pages or complex UI.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
    - Reason: UI copy/layout in an existing page.
  - Skills: `frontend-ui-ux`

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 1)
  - Blocks: none

  **References**:
  - `client-next/src/app/usage/page.tsx:109` - data fetch + loading logic.
  - `client-next/src/lib/api.ts:488` - `getUsageStats()` call contract.

  **Acceptance Criteria**:
  - With backend returning zeros, UI displays a single concise troubleshooting hint.

  **QA Scenarios**:
  ```
  Scenario: Empty-state hint appears when usage is 0
    Tool: Playwright (playwright skill)
    Steps:
      1. Start server + client: `npm start`
      2. Navigate to `http://localhost:1080/usage`
      3. Wait for loading to complete
      4. Assert visible text contains `opencode db path`
      5. Save a screenshot
    Evidence: .sisyphus/evidence/task-2-empty-state-hint.png
  ```

- [x] 3. Docs: update troubleshooting to mention SQLite migration + `opencode db` prerequisite

  **What to do**:
  - Update `README.md` and/or `server/README.md` troubleshooting:
    - Note OpenCode `>= 1.2.0` uses SQLite `opencode.db` for sessions.
    - Add “verify with `opencode db path`” and “backend requires `opencode` available on PATH”.

  **Recommended Agent Profile**:
  - Category: `writing`

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 1)

  **References**:
  - `README.md` troubleshooting section.
  - Upstream release notes: https://github.com/anomalyco/opencode/releases/v1.2.0

  **Acceptance Criteria**:
  - Docs include the exact command `opencode db path` and explain what to look for.

  **QA Scenarios**:
  ```
  Scenario: Docs mention SQLite and opencode db path
    Tool: Bash
    Steps:
      1. `rg -n "opencode db path" README.md server/README.md`
      2. Assert at least one match
    Evidence: .sisyphus/evidence/task-3-docs-grep.txt
  ```

- [ ] 4. Backend: implement SQLite-backed totals + byModel + byProject

  **What to do**:
  - In `server/index.js` `/api/usage` handler:
    - If SQLite is available, compute:
      - `totalTokens` and `totalCost`
      - `byModel[]` entries: `{name, cost, tokens, inputTokens, outputTokens}`
      - `byProject[]` entries: `{id, name, cost, tokens, inputTokens, outputTokens}`
    - Use aggregated SQL (bounded output), not per-message row dumps.
    - Preserve legacy filters:
      - role == assistant
      - time window uses request `from/to` or derived from `range`
      - project filtering (apply in JS to avoid SQL injection from projectId)

  **Recommended SQL (examples)**:
  - Totals:
    - `SUM(COALESCE(json_extract(m.data,'$.tokens.input'),0) + COALESCE(json_extract(m.data,'$.tokens.output'),0)) AS totalTokens`
  - By model group:
    - group by `json_extract(m.data,'$.modelID')`
  - By project group:
    - join `message m -> session s -> project p` and group by `s.project_id`

  **Must NOT do**:
  - Don’t change response field names or sorting.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
    - Reason: Non-trivial SQL + compatibility + aggregation logic.

  **Parallelization**:
  - Can Run In Parallel: YES (with Tasks 5-6, once Task 1 is done)
  - Blocked By: 1
  - Blocks: 7

  **References**:
  - `server/index.js:4012` - current JSON-scanning implementation to preserve semantics.
  - OpenCode SQLite schema:
    - https://raw.githubusercontent.com/anomalyco/opencode/8c1af9b445a45128d147f6f818dfd3ed7c4e75ef/packages/opencode/src/session/session.sql.ts
    - https://raw.githubusercontent.com/anomalyco/opencode/8c1af9b445a45128d147f6f818dfd3ed7c4e75ef/packages/opencode/src/project/project.sql.ts

  **Acceptance Criteria**:
  - `curl "$BASE/api/usage?from=$FROM&to=$TO"` returns `totalTokens > 0` after generating a new assistant message.
  - `totalTokens` matches the totals query from Metis (epsilon for cost).

  **QA Scenarios**:
  ```
  Scenario: /api/usage totals match SQLite aggregate (24h)
    Tool: Bash
    Steps:
      1. `FROM=$(node -p "Date.now()-24*60*60*1000"); TO=$(node -p "Date.now()")`
      2. `opencode db "SELECT COALESCE(SUM(COALESCE(json_extract(data,'$.tokens.input'),0)+COALESCE(json_extract(data,'$.tokens.output'),0)),0) AS totalTokens FROM message WHERE time_created BETWEEN $FROM AND $TO AND json_extract(data,'$.role')='assistant'" --format=json > .sisyphus/evidence/task-4-expected-totals.json`
      3. `curl -s "$BASE/api/usage?from=$FROM&to=$TO" > .sisyphus/evidence/task-4-actual-usage.json`
      4. Assert `totalTokens` equals expected
    Evidence: .sisyphus/evidence/task-4-expected-totals.json and .sisyphus/evidence/task-4-actual-usage.json

  Scenario: Project filter does not error
    Tool: Bash
    Steps:
      1. Identify a project id: `opencode db "SELECT project_id AS id FROM session LIMIT 1" --format=json`
      2. Call `curl -s "$BASE/api/usage?projectId=<id>&from=$FROM&to=$TO"`
      3. Assert response is valid JSON and has expected keys
    Evidence: .sisyphus/evidence/task-4-project-filter.json
  ```

- [ ] 5. Backend: implement SQLite-backed `byDay` with legacy-compatible granularity

  **What to do**:
  - Preserve `granularity` behavior from legacy code:
    - hourly -> ISO hour bucket
    - daily -> YYYY-MM-DD
    - weekly -> Monday-start date string (match legacy JS algorithm)
    - monthly -> YYYY-MM-01
  - Ensure each `byDay[]` row includes:
    - `date`, `cost`, `tokens`, `inputTokens`, `outputTokens`
    - dynamic keys: `${modelID}_input` and `${modelID}_output` (used by frontend for stacked bars)
  - Use SQL to aggregate at least to day+model; merge to weekly/monthly in JS as needed.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`

  **Parallelization**:
  - Can Run In Parallel: YES (with Tasks 4 and 6 once Task 1 is done)
  - Blocked By: 1
  - Blocks: 7

  **References**:
  - `server/index.js:4107` - legacy bucket logic to match.
  - `client-next/src/app/usage/page.tsx:155` - frontend expects `${mid}_input/${mid}_output` keys.

  **Acceptance Criteria**:
  - `byDay` is non-empty for a window with assistant messages.
  - Hourly/daily/monthly keys are correctly formatted.

  **QA Scenarios**:
  ```
  Scenario: byDay includes per-model token keys
    Tool: Bash
    Steps:
      1. Fetch usage: `curl -s "$BASE/api/usage?range=7d&granularity=daily" > .sisyphus/evidence/task-5-byday.json`
      2. Assert at least one `byDay[0]` has keys ending with `_input` and `_output`
    Evidence: .sisyphus/evidence/task-5-byday.json
  ```

- [ ] 6. Backend hardening: input validation, range caps, caching, debug diagnostics, fallback

  **What to do**:
  - Validate `from/to` are finite integers (ms) and clamp to a max window (e.g., 1y) to prevent heavy scans.
  - Add a short TTL cache (5-15s) keyed by query params to avoid refresh storms spawning `opencode` repeatedly.
  - Add single-flight / concurrency limit for `opencode db` execution.
  - Fallback behavior:
    - If SQLite path not found or `opencode` missing/fails: run existing legacy JSON scanner.
    - If both fail: return zeros; if `debug=1`, include an `error` field describing why.
  - Optional: `?source=sqlite|legacy` override for debugging.

  **Recommended Agent Profile**:
  - Category: `quick`

  **Parallelization**:
  - Can Run In Parallel: YES (after Task 1)
  - Blocked By: 1
  - Blocks: 7

  **References**:
  - `server/index.js:4012` - current endpoint.
  - `server/index.js:556` - `getPaths()` / config detection patterns.

  **Acceptance Criteria**:
  - When `opencode` binary is unavailable, `/api/usage` still returns a valid JSON response (legacy fallback or zeros).
  - When `debug=1`, response contains a clear error string if SQLite mode fails.

  **QA Scenarios**:
  ```
  Scenario: debug mode returns clear error when opencode is missing
    Tool: Bash
    Steps:
      1. Temporarily start server with PATH excluding opencode (agent-controlled env)
      2. Call `curl -s "$BASE/api/usage?debug=1"`
      3. Assert JSON includes `error` describing missing opencode
    Evidence: .sisyphus/evidence/task-6-missing-opencode.json
  ```

- [ ] 7. End-to-end QA and evidence capture

  **What to do**:
  - Run the Metis-proposed verification script:
    - Create (or confirm) at least one assistant message in last 24h.
    - Compare `/api/usage` totals vs SQLite totals via `opencode db`.
    - Validate `byModel`, `byDay`, `byProject` are well-formed.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: (optional) `playwright` only if you want to verify the UI visually; otherwise `curl` is sufficient.

  **Parallelization**:
  - Can Run In Parallel: NO
  - Blocked By: 4, 5, 6

  **Acceptance Criteria**:
  - Evidence files exist:
    - `.sisyphus/evidence/task-7-expected.json`
    - `.sisyphus/evidence/task-7-actual.json`
    - `.sisyphus/evidence/task-7-diff.txt`

  **QA Scenarios**:
  ```
  Scenario: Totals match exactly for 24h window
    Tool: Bash
    Steps:
      1. Compute FROM/TO
      2. Run expected totals query via `opencode db ... --format=json` and save
      3. Curl `/api/usage?from=...&to=...` and save
      4. Run a node script to compare totals (epsilon for cost)
    Evidence: .sisyphus/evidence/task-7-expected.json and .sisyphus/evidence/task-7-actual.json
  ```

---

## Success Criteria

### Verification Commands
```bash
BASE="http://127.0.0.1:1920"
FROM=$(node -p "Date.now()-24*60*60*1000")
TO=$(node -p "Date.now()")

opencode db "SELECT COUNT(*) AS n FROM message WHERE time_created BETWEEN $FROM AND $TO AND json_extract(data,'$.role')='assistant'" --format=json
curl -s "$BASE/api/usage?from=$FROM&to=$TO" | jq '{totalTokens,totalCost,byModelCount:(.byModel|length),byDayCount:(.byDay|length)}'
```

### Final Checklist
- [ ] `/usage` is non-zero after a new assistant message
- [ ] `/api/usage` matches SQLite aggregates for same window
- [ ] Legacy JSON fallback still works on older OpenCode installs
