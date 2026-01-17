# Session Handoff - Auth UI Manual Mode Release

## Status
Released Auth UI Rework (v1.9.7) and bumped to **v1.9.8** for final release.

## Changes (v1.9.7 - v1.9.8)

### 1. Manual Account Management
- **Automatic Quota Disabled**: Removed `LogWatcher` and auto-rotation logic. Switching is now fully manual via the UI.
- **Simplified UI**: Removed Quota/Limit progress bars and controls from the Account Pool card.
- **Manual Switch**: Accounts list now serves as a manual switcher.

### 2. Configurable Cooldowns
- **Cooldown Rules**: New section in **Settings** page to define cooldown rules (Name -> Duration).
  - Defaults: "Opus 4.5 (Antigravity)" (4h), "Gemini 3 Pro (Antigravity)" (24h).
- **Mark Cooldown**: "Mark Cooldown" action in Auth page now opens a dialog to select a rule or use default (1h).
- **API**: Added endpoints to manage cooldown rules (`GET/POST/DELETE /api/cooldowns`) and updated `PUT .../cooldown` to accept a rule name.

### 3. Stability & Fixes
- **Add Account Detection**: Server auto-imports Google accounts from `auth.json` when the client polls (fixing the "not detecting" issue).
- **Windows File Locking**: `atomicWriteFileSync` now retries on `EPERM` errors.

## Verification
- **Settings**: Verify you can add/delete cooldown rules.
- **Auth Page**:
  - Verify Quota UI is gone.
  - Verify "Mark Cooldown" opens dialog with rules.
  - Verify selecting a rule sets the correct duration.
  - Verify "Add Google Account" detects the login.

## Next Steps
- **Restart Server**: Required to apply changes.
- **Run build**: `cd client-next && npm run build` to ensure client matches new version requirement.
