# Session Handoff - Clear All Feature (v1.10.0)

## Status
Added "Clear All" functionality to Auth UI and bumped to **v1.10.0**.

## Changes (v1.10.0)

### 1. Clear All Accounts
- **UI**: Added a trash icon button to the Account Pool card header.
- **Confirmation**: Clicking triggers a confirmation dialog ("This action cannot be undone").
- **Backend**: Uses the existing `DELETE /api/auth/profiles/:provider/all` endpoint (fixed in v1.9.6).

### 2. Previous Fixes (v1.9.9)
- **Robust Login**: Manual command fallback + continuous polling.
- **Manual Auth**: Manual switching + Cooldown Rules.

## Verification
- **Clear All**:
  1. Add multiple accounts.
  2. Click the trash icon in the pool header.
  3. Confirm dialog.
  4. Verify all accounts are removed and list is empty.

## Next Steps
- **Restart Server**: Required for v1.10.0.
- **Run build**: `cd client-next && npm run build` to ensure client matches new version requirement.
