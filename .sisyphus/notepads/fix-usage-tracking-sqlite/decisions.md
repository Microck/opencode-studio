# Architectural Decisions - Fix Usage Tracking SQLite

## Design Choices
<!-- Agents append here when making architectural decisions -->

## Task 5 Decisions

- Implemented SQLite aggregation for `byDay` only, preserving existing totals/byModel/byProject flow untouched per task constraint.
- Used SQL bucketing for hourly/daily/monthly and JS post-processing only for weekly Monday alignment.
- Applied project filter (`projectId`) after query using `sessionID -> projectID` map from session metadata to avoid schema assumptions in SQL joins.

## Task 4 Decisions

- Replaced legacy filesystem scan for totals/byModel/byProject with a single SQLite aggregate query joined across `message`, `session`, and `project`.
- Kept `projectId` filtering in JavaScript post-query to avoid building SQL from user input, while still keeping SQL bounded.
- Standardized cost computation to token-based pricing map in the endpoint so totals, model rows, and project rows are derived consistently from tokens.
- Left response shape unchanged (`totalCost`, `totalTokens`, `byModel`, `byDay`, `byProject`) for frontend compatibility.

## Task 6 Decisions

- Added hardening around existing SQLite logic instead of rewriting SQL internals, keeping task boundaries clear.
- Implemented in-memory cache with 10s TTL and cache key scoped by normalized filters/source/debug.
- Implemented single-flight dedupe map keyed the same way as cache to collapse concurrent identical requests.
- Implemented fallback policy: `auto` tries SQLite then legacy; `sqlite` does not fallback; `legacy` bypasses SQLite entirely.
