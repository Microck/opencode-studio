# Session Handoff - Auth & Rotation Fixes

## Status
Completed verification of v1.9.4 features and fixed a critical bug in `DELETE /api/auth/profiles/:provider/all`.
Bumped version to **v1.9.5**.

## Changes

### 1. Auto-Rotation System (v1.9.0 - Verified)
- **Log Watcher**: Enhanced to detect `429` errors and quota exhaustion.
- **Auto-Rotation**: Automatically switches to the next available account in the pool when a rate limit is hit.
- **Cooldowns**: Marks failed accounts with a 1-hour cooldown.
- **Debounce**: Prevents cascading failures with a 10s rotation debounce.

### 2. Authentication Fixes (v1.9.2 - v1.9.5)
- **Clear All Fixed (v1.9.5)**: Fixed route conflict where `DELETE /.../all` was being captured by `DELETE /.../:name`.
  - Moved `/all` route definition **before** `/:name`.
  - Verified files are actually deleted from disk.
- **Path Resolution**: Fixed `delete`/`rename`/`activate` logic to correctly find profiles in legacy `google/` directory vs namespaced `google.antigravity/` directories.
- **Safe Logout**: "Logout" now only clears the active session (`auth.json`) and **does NOT** delete saved profiles.
- **Safety**: Added URI encoding to client API calls to handle special characters in profile names.

### 3. Versions
- **Server**: `v1.9.5` (Bumped in `server/package.json`)
- **Client Requirement**: `v1.9.5` (Updated in `api.ts`)

## Verification
- **Auto-Rotation**: Verified endpoint returns proper error when pool empty.
- **Cooldowns**: Verified mark/clear endpoints.
- **Logout**: Verified active session cleared, profile retained.
- **Activate**: Verified switching profiles works.
- **Clear All**: Verified files are deleted (bug fix confirmed).
- **UI**: Verified main buttons (Refresh, Toggle, Profiles dropdown).

## Next Steps
- User needs to **restart the server** to apply `v1.9.5` changes.
- **Run build**: `cd client-next && npm run build` to ensure client matches new version requirement.
