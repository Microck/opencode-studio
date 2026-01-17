# Plan: Fix Proxy Dashboard and Account Listing

## Context
User reports:
1. Dashboard button opens a 404 page (or fails to connect).
2. "Active Accounts Pool" list is empty.
3. API `/api/proxy/accounts` returns 500 Internal Server Error.

## Diagnosis
- The dashboard might not be served by the binary in headless/cli mode or config disabled it.
- The 500 error suggests `server/proxy-manager.js:listAccounts` is throwing an unhandled exception, likely during file reading or parsing of the auth directory.

## Steps

### 1. Remove Dashboard Button
Edit `client-next/src/app/auth/page.tsx` to remove the "Dashboard" button. It causes confusion and doesn't work reliably.

### 2. Fix `listAccounts` in `server/proxy-manager.js`
- Wrap the directory reading logic in a `try/catch` block that logs the error and returns an empty array `[]` on failure.
- Validate `fs.readdirSync` result.
- Improve file name parsing to handle unexpected formats without throwing.

### 3. Verify Auth Directory
- Ensure `PROXY_AUTH_DIR` constant is correct.
- If directory doesn't exist, `listAccounts` should return `[]` (already implemented but maybe buggy).

### 4. Verification
- Use `curl` to check `/api/proxy/accounts` returns 200 OK and JSON array.
- Reload frontend to see if "Active Accounts Pool" populates (if accounts exist) or at least doesn't show "Failed to load".
