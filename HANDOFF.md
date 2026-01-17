# Session Handoff - Auth UI Rework (Manual Mode)

## Status
Reworked Auth system to support manual account switching and configurable cooldowns, disabling the automatic quota/rotation system as requested.
Bumped version to **v1.9.7**.

## Changes (v1.9.7)

### 1. Manual Account Management
- **Automatic Quota Disabled**: Removed `LogWatcher` and auto-rotation logic. Switching is now fully manual via the UI.
- **Simplified UI**: Removed Quota/Limit progress bars and controls from the Account Pool card.
- **Manual Switch**: Accounts list now serves as a manual switcher.

### 2. Configurable Cooldowns
- **Cooldown Rules**: New section in **Settings** page to define cooldown rules (Name -> Duration).
  - Defaults: "Opus 4.5 (Antigravity)" (4h), "Gemini 3 Pro (Antigravity)" (24h).
- **Mark Cooldown**: "Mark Cooldown" action in Auth page now opens a dialog to select a rule or use default (1h).
- **API**: Added endpoints to manage cooldown rules (`GET/POST/DELETE /api/cooldowns`) and updated `PUT .../cooldown` to accept a rule name.

### 3. Stability & Fixes (From v1.9.6)
- **Add Account Detection**: Server auto-imports Google accounts from `auth.json` when the client polls (fixing the "not detecting" issue).
- **Windows File Locking**: `atomicWriteFileSync` now retries on `EPERM` errors.

## Verification
- **Settings**: Verify you can add/delete cooldown rules.
- **Auth Page**:
  - Verify Quota UI is gone.
  - Verify "Mark Cooldown" opens dialog with rules.
  - Verify selecting a rule sets the correct duration.
  - Verify "Add Google Account" detects the login (via v1.9.6 fix).

## Next Steps
- **Restart Server**: Required for v1.9.7 changes (LogWatcher disable).
- **Rebuild Client**: Required for UI updates.
