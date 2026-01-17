# Session Handoff - Auth UI Robustness (v1.9.9)

## Status
Fixed "Failed to start Google login" and "Not detecting" issues by making the login flow robust with manual fallback and continuous polling.
Bumped version to **v1.9.9**.

## Changes (v1.9.9)

### 1. Robust Login Flow
- **Continuous Polling**: Login polling now starts *immediately* and continues even if the automatic terminal launch fails. This ensures that if the user runs the command manually, the UI will still detect it.
- **Manual Command Fallback**: If the automatic terminal launch fails, the UI now displays the exact command to run (with a Copy button) instead of just an error.

### 2. Manual Auth (from v1.9.7)
- **Manual Switching**: Simplified pool UI for manual account switching.
- **Configurable Cooldowns**: Rules-based cooldowns in Settings.

## Verification
- **Test Failure**: Try to login. If terminal fails, verify the command is shown.
- **Test Detection**: Run the command manually. Verify the UI updates within 3 seconds.

## Next Steps
- **Restart Server**: Required for v1.9.9.
- **Run build**: `cd client-next && npm run build` to ensure client matches new version requirement.
