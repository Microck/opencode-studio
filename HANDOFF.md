# Session Handoff - Dynamic Auth Pools (v1.12.0)

## Status
Refactored Auth UI to dynamically treat any provider with multiple accounts as a "Pool". Bumped to **v1.12.0**.

## Changes (v1.12.0)

### 1. Dynamic Pool Logic
- **Unified Rendering**: "Google" and "OpenAI" are no longer hardcoded sections. All providers are iterated dynamically.
- **Auto-Promotion**: Any provider with saved profiles is automatically promoted to the Main Column and rendered with the full `AccountPoolCard` UI.
- **Single Column**: Providers with no profiles (simple connection) stay in the Sidebar (unless pinned like Google).

### 2. Code Refactor
- **Generic Handlers**: Replaced `handlePoolActivate`, `handleOpenaiPoolActivate`, etc. with a single `handleActivate(provider, name)` function. Same for Rotate, Remove, Cooldown.
- **Profiles-to-Pool Adapter**: Added `profilesToPool` helper to adapt standard `AuthProfilesInfo` into `AccountPool` structure for consistent UI.

### 3. Google Integration
- **Just Another Provider**: Google is now just the first item in the list.
- **Plugin Switcher**: Integrated into the Google card header.
- **Login Fallback**: Manual command fallback works for all providers.

## Verification
- **Multi-Account**: Add 2+ profiles to Anthropic (if possible) -> It should move to Main Column as a Pool.
- **Google**: Still works as before (with Antigravity features if enabled).
- **Clear All**: Works for any provider in Main Column.

## Next Steps
- **Restart Server**: Required for v1.12.0.
- **Run build**: `cd client-next && npm run build`.
