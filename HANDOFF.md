# Session Handoff - Cloud Sync Implementation

## Status
Completed implementation of Cloud Sync using OAuth for Dropbox and Google Drive.
- Replaced folder-based sync with direct API integration
- Added OAuth endpoints to server (Dropbox + Google Drive)
- Updated Settings UI with "Connect" buttons
- Implemented auto-sync logic (pull on startup, push on save)

## Changes
- **Server**: Bumped to `1.8.0`. Added `/api/sync/{dropbox|gdrive}/*` endpoints.
- **Client**: Bumped `MIN_SERVER_VERSION` to `1.8.0`. Updated `api.ts` and `settings/page.tsx`.
- **Docs**: Updated README.md with new sync setup instructions.

## Verification
- Run `npm start` to launch both services.
- Go to `/settings` -> Cloud Sync.
- Test "Connect Dropbox" and "Connect Google Drive".
- Verify `opencode-studio-sync.json` is created in cloud root on Push.
- Verify Pull restores config from cloud.

## Next Steps
- User needs to provide real Client IDs/Secrets in `server/index.js` (currently placeholders).
- Test Google Drive flow (complex multipart upload logic).
- Consider adding OneDrive support (Microsoft Graph API).
