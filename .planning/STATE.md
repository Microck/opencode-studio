# Project State

## Project Reference

See: README.md

**Core value:** Local GUI for managing OpenCode CLI configs without JSON editing - toggle MCPs, edit skills, manage plugins, handle auth, profiles, usage dashboard
**Current focus:** Maintenance and bug fixes (GitHub backup error + multi-location discovery)

## Current Position

Phase: 01-location-proof
Status: Plan 01-03 complete
Last activity: 2026-01-30 — Completed 01-03-PLAN.md (Agents API multi-location aggregation)

Progress: [██░░░░░░░] 1/4 plans complete (25%)

## Performance Metrics

**Velocity:** Not tracked (no GSD history)

**By Phase:** Not applicable

**Recent Trend:** Active development with multiple pending investigations

## Accumulated Context

### Decisions

No formal decision log. Recent context:
- Multi-location loading analysis: MCPs ✅ aggregated, Commands ✅ aggregated, Agents ✅ aggregated (01-03), Models ❌ not aggregated
- Plan 01-03: Implemented aggregateAgents() with source tracking (json-config, markdown, builtin)

### Deferred Issues

**High Priority:**
- GitHub Backup 500 Error (TODO-GitHub-Backup-Investigation.md)
  - Reproduce "Push to GitHub" error in Settings
  - Check server logs, verify credentials, test `/api/backup` endpoint
  - Determine root cause of 500 Internal Server Error

**Codebase Concerns** (from .planning/codebase/CONCERNS.md):
- Tech Debt: Monolithic `server/index.js` (800+ lines), busy-wait loop, CommonJS/ESM mix
- Known Bugs: Auto-shutdown on idle (30 min timeout)
- Security: Broad CORS policy, sync file operations
- Performance: Large log parsing may become slow
- Test Coverage: Zero automated tests (high regression risk)

### Pending Todos

None captured in .planning/todos/

### Blockers/Concerns

- **None blocking current work**

## Session Continuity

Last session: 2026-01-30
Stopped at: Completed 01-03-PLAN.md (Agents API multi-location aggregation)
Resume file: None
