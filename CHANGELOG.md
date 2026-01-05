# Changelog

All notable changes to this project will be documented in this file.

## [1.0.6] - 2026-01-05

### Fixed
- **Auth Login**: Use `exec` with `start` on Windows for reliable browser opening.

## [1.0.5] - 2026-01-05

### Fixed
- **Auth Login**: Fixed OAuth browser not opening when server runs headless (via protocol handler).

## [1.0.4] - 2026-01-05

### Added
- **Multi-Account Authentication**: Support for saving multiple profiles per provider (e.g., multiple GitHub or Google accounts) and switching between them instantly.
- **Theme-Aware Logo**: New logo design that automatically adapts to light/dark mode.
- **Preview GIF**: Added animated preview to README showing dark/light mode transition.
- **Fonts**: Switched to **Rethink Sans** for headings and **Geist** for body text, keeping **Commit Mono** for code.
- **Gemini Plugin Detection**: Smart detection for `opencode-gemini-auth` with one-click install prompt.
- **Custom Domain**: Now available at [opencode.micr.dev](https://opencode.micr.dev).

### Changed
- **Auth UI Overhaul**: 
  - Simplified "Connected" view.
  - Hidden confusing OAuth expiry timers.
  - "Add Account" button for easy multi-profile setup.
  - Subtle prompt for Gemini plugin installation.
- **Card Design**: Improved hover effects with full-width clickable areas and better vertical alignment.
- **Settings Schema**: Aligned settings with official OpenCode schema.
- **Navigation**: Removed "Models" tab in favor of configuration via Settings.

### Fixed
- **CORS**: Added `micr.dev` domains to allowed origins.
- **Protocol Handler**: Fixed Windows VBScript path escaping for registry.
- **API URL**: Changed to `127.0.0.1` to avoid mixed content issues.
- **Hover Clipping**: Fixed issue where hover shadows were clipped.
- **Landing Page**: Prevented scrolling on disconnected state.

## [0.1.0] - 2024-01-01

### Initial Release
- **MCP Manager**: Toggle servers, add via npx, search/filter.
- **Skill/Plugin Editor**: Monaco-based editor for Markdown skills and JS/TS plugins.
- **Auth Manager**: OAuth login flow and API key management.
- **Protocol Handler**: Deep link support (`opencodestudio://`) for one-click installs.
- **Quickstart**: Guided onboarding flow.
- **Bulk Import**: Paste multiple URLs to import skills/plugins.
