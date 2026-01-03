# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Project todos.md for tracking implementation progress
- This CHANGELOG.md file
- `install.bat` and `install.sh` for dependency installation
- `start.bat` and `start.sh` for launching the app
- `GET /api/health` endpoint for connection status detection
- `server/cli.js` - CLI entry point for `npx opencode-studio-server`
- `server/register-protocol.js` - registers `opencodestudio://` protocol handler
- Protocol handler support via `protocol-registry` package
- `checkHealth()` function in frontend API client
- Connection status indicator in sidebar (green/red dot)
- "Launch Backend" button when disconnected (triggers protocol handler)
- Auto-polling health check every 3 seconds
- `connected` state in AppContext for connection awareness
- `.vercelignore` for Vercel deployment
- `next.config.ts` updated for standalone output
- Dual-mode documentation in README (public site + local backend)

### Changed
- `quickstart.bat` now calls install.bat + start.bat
- `quickstart.sh` now calls install.sh + start.sh
- Server CORS now explicitly allows localhost and *.vercel.app
- `server/package.json` renamed to `opencode-studio-server` with bin/postinstall

### Changed

### Fixed
