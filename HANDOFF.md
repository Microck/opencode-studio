# Session Handoff - Auth & Rotation Fixes

## Status
Completed verification of v1.9.4 features and fixed two critical bugs:
1. `DELETE /api/auth/profiles/:provider/all` (Route conflict)
2. **Add Google Account Detection**: Antigravity pool now auto-imports accounts from `auth.json`.

Bumped version to **v1.9.6**.

## Changes

### 1. Auto-Rotation System (v1.9.0 - Verified)
- **Log Watcher**: Enhanced to detect `429` errors and quota exhaustion.
- **Auto-Rotation**: Automatically switches to the next available account in the pool when a rate limit is hit.
- **Cooldowns**: Marks failed accounts with a 1-hour cooldown.
- **Debounce**: Prevents cascading failures with a 10s rotation debounce.

### 2. Authentication Fixes (v1.9.2 - v1.9.6)
- **Add Account Detection (v1.9.6)**: Added `importCurrentGoogleAuthToPool` to `GET /api/auth`. Server now checks `auth.json` on every poll and imports new Google accounts into the Antigravity pool automatically.
- **File Locking Fix (v1.9.6)**: Updated `atomicWriteFileSync` with retry logic to handle Windows `EPERM` errors during rapid updates.
- **Clear All Fixed (v1.9.5)**: Fixed route conflict where `DELETE /.../all` was being captured by `DELETE /.../:name`.
- **Path Resolution**: Fixed `delete`/`rename`/`activate` logic to correctly find profiles in legacy `google/` directory vs namespaced `google.antigravity/` directories.
- **Safe Logout**: "Logout" now only clears the active session (`auth.json`) and **does NOT** delete saved profiles.

### 3. Versions
- **Server**: `v1.9.6` (Bumped in `server/package.json`)
- **Client Requirement**: `v1.9.6` (Updated in `api.ts`)

## Verification
- **Add Account**: Verified logic to import `auth.json` to pool.
- **Clear All**: Verified files are deleted (bug fix confirmed).
- **Auto-Rotation**: Verified endpoint returns proper error when pool empty.
- **Cooldowns**: Verified mark/clear endpoints.
- **Logout**: Verified active session cleared, profile retained.
- **Activate**: Verified switching profiles works.

## Next Steps
- User needs to **restart the server** to apply `v1.9.6` changes.
- **Run build**: `cd client-next && npm run build` to ensure client matches new version requirement.
