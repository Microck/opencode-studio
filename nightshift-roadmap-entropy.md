# Roadmap Entropy Analysis — OpenCode Studio

**Date:** 2026-04-03  
**Analyzer:** Nightshift v3 (Automated)  
**Codebase:** Microck/opencode-studio  
**Branch:** master  
**Scope:** Full-stack analysis (server + client-next)

---

## Executive Summary

OpenCode Studio is a local GUI for managing OpenCode configurations (MCP servers, skills, plugins, auth). The project shows significant **roadmap entropy**, primarily driven by:

1. **Explosive growth of a monolithic server file** (4,667 lines in a single `index.js`) that absorbed at least 6 major feature domains without decomposition.
2. **Multiple abandoned or neutered features** — most notably the "Proxy Manager" (CLIProxyAPI integration) which was documented in CHANGELOG across 3 versions but has been silently gutted from the frontend while leaving server-side residue.
3. **Scope creep in the authentication subsystem**, which grew from simple login/logout to a ~1,200-line multi-account pool management system with quota tracking, auto-rotation, cooldown rules, and a full Google OAuth PKCE flow — none of which appears in the README's stated feature scope.
4. **Documentation misalignment** — README documents 8 route sections; the sidebar exposes 13. Multiple CHANGELOG entries are duplicated. Features documented in CHANGELOG don't exist in current code and vice versa.

**Overall Entropy Score: 6.8 / 10**

The codebase is functional but shows clear signs of organic, unmanaged feature accumulation without architectural refactoring. The server layer is the most affected.

---

## Findings by Severity

### P0 — Critical Structural Issues

#### P0-1: Monolithic 4,667-line server file
- **File:** `server/index.js`
- **Lines:** 1–4667 (entire file)
- **Description:** The entire backend is a single Express app file containing: config management, auth (login/logout/profiles/pools), MCP management, skill/plugin CRUD, agents CRUD, commands, usage analytics, log streaming, GitHub backup/restore, Dropbox sync, presets, rules, system prompts, deep-link handling, and Google OAuth PKCE. There are no modules, no router decomposition, no service layer separation.
- **Evidence:** Only two other server files exist: `profile-manager.js` (88 lines) and `cli.js` (156 lines). The remaining ~4,500 lines of business logic are in `index.js`.
- **Recommendation:** Decompose into router modules (e.g., `routes/auth.js`, `routes/skills.js`, `routes/sync.js`, etc.) and a shared service layer. This is the single highest-impact refactor.

#### P0-2: API routes registered after module.exports
- **File:** `server/index.js`
- **Lines:** 4627 (module.exports), 4637–4667 (routes still being registered)
- **Description:** The `/api/prompts/global` GET and POST endpoints are defined AFTER the `module.exports` block. While this works in Node.js (because `app` is already set up), it indicates these routes were bolted on after the "main" server code was considered complete. This is a structural smell suggesting unplanned feature addition.
- **Recommendation:** Move all route definitions before `module.exports` during server decomposition.

#### P0-3: Duplicate CHANGELOG version entries
- **File:** `CHANGELOG.md`
- **Lines:** 5–11 (1.16.0 duplicated), 32–42 (1.14.5 duplicated twice), 42–50 (1.14.7 duplicated)
- **Description:** Version 1.16.0, 1.14.5, and 1.14.7 each appear twice with identical or near-identical content. This suggests publish automation failures where entries were manually re-added instead of deduplicating.
- **Recommendation:** Audit CHANGELOG for duplicate entries and deduplicate. Consider automating changelog generation.

---

### P1 — Significant Scope Creep & Drift

#### P1-1: Dead Proxy Manager feature (CLIProxyAPI)
- **File:** `server/index.js`, lines 3533–3553 (CLIProxyAPI residual code)
- **File:** `CHANGELOG.md`, lines 95–106 (v1.13.0 Proxy Manager documentation)
- **File:** `CHANGELOG.md`, lines 62–79 (v1.14.x Proxy fix entries)
- **File:** `.changeset/remove-proxy-config.md`
- **Description:** CHANGELOG v1.13.0 documents a full "Proxy Manager" with CLIProxyAPI integration for multi-account rotation and rate-limit handling. Multiple v1.14.x entries fix proxy detection and configuration. A changeset exists titled `remove-proxy-config`. However, the Proxy Manager UI has been completely removed from the frontend — there is no proxy section in the sidebar or any proxy-related client component. The server still contains residual code reading `~/.cli-proxy-api/` directory for account sync (line 3534), but this is vestigial.
- **Recommendation:** Remove the CLIProxyAPI directory scanning code in `syncAntigravityPool()`. Add a CHANGELOG entry documenting the Proxy Manager removal. Clean up any remaining proxy-related dead code.

#### P1-2: Dropbox sync integration with placeholder credentials
- **File:** `server/index.js`, line 1683
- **Description:** A complete Dropbox OAuth flow, push/pull sync, and auto-sync system exists (~200 lines, lines 1680–1968) but uses a hardcoded placeholder `DROPBOX_CLIENT_ID = 'your-dropbox-app-key'`. The client has corresponding API functions (`getDropboxAuthUrl`, `dropboxCallback`, `syncPush`, `syncPull`, `syncAuto`). The Settings page has a "Sincronizado" card (which links to an external product) but no Dropbox sync UI. This feature appears to be a partially implemented, then abandoned, cloud sync system.
- **Recommendation:** Either complete the Dropbox integration (with proper env var configuration) and add UI, or remove the dead code. The current state is misleading — the API exists but is non-functional.

#### P1-3: Authentication subsystem scope explosion
- **File:** `server/index.js`, lines 2714–3962 (~1,250 lines)
- **Description:** The auth system has grown from simple login/logout to include:
  - Multi-provider auth (11 providers)
  - Multi-profile save/switch per provider
  - Account pool management with status tracking (active/ready/cooldown/expired)
  - Quota tracking with daily limits and auto-reset estimation
  - Auto-rotation on 429 errors (log-watcher triggered)
  - Cooldown rules with configurable durations
  - Antigravity account sync from multiple sources
  - Full Google OAuth PKCE flow (lines 4215–4445)
  - Pool metadata persistence
  
  This subsystem is ~27% of the entire server file. The README describes auth as "login/logout per provider, save and switch between credential profiles" — massively understating the actual scope.
- **Recommendation:** Extract into `routes/auth.js`, `services/auth-pool.js`, `services/auth-profiles.js`. Document the full scope in README.

#### P1-4: README vs sidebar route mismatch (5 undocumented routes)
- **File:** `README.md`, lines 86–96 (documented routes)
- **File:** `client-next/src/components/sidebar.tsx`, lines 30–44 (actual nav items)
- **Description:** README documents 8 routes: `/mcp`, `/profiles`, `/skills`, `/plugins`, `/commands`, `/usage`, `/auth`, `/settings`. The sidebar exposes 13 routes, adding:
  - `/agents` (full agents management page)
  - `/logs` (live log viewer with SSE streaming)
  - `/rules` (AGENTS.md/CLAUDE.md editor)
  - `/settings/code` (code-level settings editor)
  - `/config` (raw JSON config editor)
- **Recommendation:** Update README to document all available routes and their purpose.

#### P1-5: Hardcoded model catalog in default studio config
- **File:** `server/index.js`, lines 381–513 (~130 lines)
- **Description:** The `loadStudioConfig()` default config contains ~130 lines of hardcoded Gemini, Antigravity, and other model definitions with variants, thinking configs, cost data, limits, and modalities. This data should be in a separate configuration file or fetched from an external source, not embedded in a JavaScript function.
- **Recommendation:** Extract model catalog to `data/plugin-models.json` or similar. Load dynamically.

---

### P2 — Moderate Drift Indicators

#### P2-1: Duplicate type definitions in TypeScript
- **File:** `client-next/src/types/index.ts`
- **Lines:** 347–351 vs 476–480 (`RulesResponse` defined twice), 341–345 vs 482–485 (`SystemToolInfo` defined twice), 64–68 vs 469–474 (`AgentInfo` defined twice)
- **Description:** Three interfaces are defined twice in the same file with slightly different shapes. This will cause TypeScript compilation errors or require type merging workarounds.
- **Recommendation:** Remove duplicate interface definitions and reconcile any property differences.

#### P2-2: Redundant provider list definitions
- **File:** `server/index.js`
- **Lines:** 2803–2816 (`/api/auth/providers` handler), 2820–2832 (`/api/auth` handler)
- **Description:** The providers array `[{id: 'google', name: 'Google', ...}, ...]` is defined identically in two route handlers, with the first version also including `description` fields. This violates DRY and means provider additions require updating two places.
- **Recommendation:** Extract to a shared constant (e.g., `const AUTH_PROVIDERS = [...]`).

#### P2-3: Permission/permissions dual-naming schema drift
- **File:** `server/index.js`
- **Lines:** 1370–1373, 1421–1424 (normalization code), 1291–1292 (dual assignment)
- **Description:** Throughout the codebase, both `permission` and `permissions` are used for the same concept. Server code contains normalization logic `if (normalizedConfig.permissions && !normalizedConfig.permission)` in multiple places. The types file defines both `permissions?: PermissionConfig` and `permission?: PermissionConfig` on `AgentConfig`.
- **Recommendation:** Standardize on one key name. Add a migration step for existing configs if needed.

#### P2-4: Duplicate section header comments
- **File:** `server/index.js`
- **Lines:** 3343–3347
- **Description:** The comment `// ACCOUNT POOL MANAGEMENT (Antigravity-style)` appears twice in succession, suggesting a copy-paste error during feature development.
- **Recommendation:** Clean up duplicate section markers.

#### P2-5: Commented-out dead code
- **File:** `server/index.js`
- **Lines:** 3308–3315
- **Description:** In the auth logout handler, code to delete profile directories and metadata on logout is commented out with explanatory comments. This indicates an intentional design change but the dead code should be removed for clarity.
- **Recommendation:** Remove commented-out code. The design intent is clear from the comment above it.

#### P2-6: Presets feature undocumented in README
- **File:** `CHANGELOG.md`, lines 133–141 (v1.3.0 Presets feature)
- **File:** `server/index.js`, lines 4497–4603 (presets API)
- **File:** `client-next/src/components/presets-manager.tsx` (UI component)
- **Description:** The Presets feature (save/apply groups of Skills, Plugins, MCPs in exclusive or additive mode) is documented in CHANGELOG v1.3.0 and has both server and client implementations, but is not listed in the README's features section.
- **Recommendation:** Add Presets to the README features list.

#### P2-7: SincronizadoCard — promotional component in settings
- **File:** `client-next/src/components/sincronizado-card.tsx`
- **Lines:** 1–43 (entire file)
- **File:** `client-next/src/app/settings/page.tsx`, line 31 (import)
- **Description:** A `SincronizadoCard` component exists that advertises an external product called "Sincronizado" with links to a GitHub repo and documentation site. This is embedded in the Settings page. It's unclear if this is a companion product, a paid offering, or a personal project. Including promotional cards for external products in the settings page feels off-roadmap.
- **Recommendation:** Evaluate whether this belongs in the core product. If it's a companion tool, document the relationship. If not, remove.

---

### P3 — Minor Entropy Indicators

#### P3-1: CHANGELOG version numbering inconsistency
- **File:** `CHANGELOG.md`
- **Description:** Version numbering jumps erratically: `0.1.0` → `1.0.4` → `1.0.5` ... `1.0.11` → `1.2.2` → `1.3.0` → `1.3.1` → `1.12.12` → `1.12.13` → `1.12.14` → `1.13.0` → `1.13.1` → `1.14.0` ... `1.16.0`. The jump from `1.3.1` to `1.12.12` suggests a separate release stream was merged.
- **Recommendation:** Add a note in CHANGELOG explaining the version history if multiple streams were merged.

#### P3-2: Unused `.env.example` references
- **File:** `server/.env.example`
- **Description:** The env example file may reference configuration keys that are no longer actively used or documents keys for features that have been removed (e.g., proxy-related keys).
- **Recommendation:** Audit `.env.example` against actual `process.env` usage in server code.

#### P3-3: Sidebar icon choices inconsistent with feature domain
- **File:** `client-next/src/components/sidebar.tsx`
- **Lines:** 30–44
- **Description:** Skills uses `Gamepad` icon, Rules uses `Sliders`, Settings also uses `Sliders`, Code Settings uses `Code` (same as Plugins). Several icons are reused for unrelated features, making visual differentiation harder.
- **Recommendation:** Assign unique, semantically meaningful icons to each nav item.

#### P3-4: `website-checklist.md` tracking file in repo
- **File:** `client-next/website-checklist.md`
- **Description:** A launch readiness checklist lives in the client source directory. This is a project management artifact, not source code. It contains unchecked items (analytics, error tracking, screen reader testing) indicating incomplete launch preparation.
- **Recommendation:** Move to project wiki or issue tracker. Don't track operational checklists in source.

#### P3-5: Debug menu using F2 key binding with no documentation
- **File:** `client-next/src/components/debug-menu.tsx`
- **Lines:** 16–24
- **Description:** A debug overlay is accessible via F2 keypress. It's not mentioned in README, sidebar, or any settings. This is a developer tool that shipped to production.
- **Recommendation:** Document the debug menu for users, or restrict it to development mode only.

#### P3-6: `findAvailablePort` defined twice
- **File:** `server/index.js`, lines 61–73
- **File:** `server/cli.js`, lines 11–26
- **Description:** The `findAvailablePort` function is implemented identically in both files. This is a minor DRY violation.
- **Recommendation:** Extract to a shared utility module.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Server lines (main file) | 4,667 |
| Distinct feature domains in server | 15+ |
| Client pages/routes | 13 |
| README-documented routes | 8 |
| Dead or abandoned features detected | 2 (Proxy Manager, Dropbox sync) |
| Duplicate CHANGELOG entries | 3 versions |
| Duplicate TypeScript interfaces | 3 interfaces |
| Overall Entropy Score | **6.8 / 10** |

## Entropy Score Rationale

| Factor | Impact | Notes |
|--------|--------|-------|
| Monolithic server file | +2.0 | Single 4,667-line file, no decomposition |
| Dead features (proxy, dropbox) | +1.2 | Documented in CHANGELOG, removed from UI, code residue remains |
| Auth scope explosion | +1.0 | 1,200 lines, 10x what README describes |
| README vs code misalignment | +0.8 | 5 undocumented routes, undocumented subsystems |
| Duplicate code (types, constants, CHANGELOG) | +0.5 | Multiple instances of DRY violations |
| Schema drift (permission/permissions) | +0.3 | Requires normalization logic scattered across codebase |
| **Total** | **6.8** | |

---

## Recommended Priority Actions

1. **Decompose `server/index.js`** into route modules (P0-1) — this enables all subsequent improvements
2. **Remove or complete dead features** (P1-1, P1-2) — reduces maintenance burden and confusion
3. **Update README** to match actual feature set (P1-4, P2-6) — reduces user confusion
4. **Extract model catalog** to data file (P1-5) — improves maintainability
5. **Deduplicate CHANGELOG** (P0-3) — improves project history accuracy
6. **Fix duplicate TypeScript types** (P2-1) — prevents compilation issues
7. **Standardize permission key naming** (P2-3) — reduces normalization complexity
