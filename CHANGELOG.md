# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Multi-Account Authentication**: Support for saving multiple profiles per provider (e.g., multiple GitHub or Google accounts) and switching between them instantly.
- **Theme-Aware Logo**: New logo design that automatically adapts to light/dark mode (inverted and rotated 180° for light mode).
- **Preview GIF**: Added animated preview to README showing dark/light mode transition.
- **Fonts**: Switched to **Rethink Sans** for headings and **Geist** for body text, keeping **Commit Mono** for code.
- **Gemini Plugin Detection**: Smart detection for `opencode-gemini-auth` with one-click install prompt.
- **Disconnect Button**: Added ability to disconnect from the backend via the UI.
- **Raw JSON Editor**: Replaced key-value inputs with raw JSON editors for complex configurations (Env vars, MCP args).

### Changed
- **Auth UI Overhaul**: 
  - Simplified "Connected" view.
  - Hidden confusing OAuth expiry timers (replaced with clean status).
  - "Add Account" button for easy multi-profile setup.
  - Subtle prompt for Gemini plugin installation.
- **Card Design**: Improved hover effects (`hover-lift`) with full-width clickable areas and better vertical alignment.
- **Settings Schema**: Aligned settings with official OpenCode schema (removed deprecated `logLevel`, fixed `permissions` key).
- **Navigation**: Removed "Models" tab (deprecated/confusing) in favor of configuration via `opencode.json` or Settings.
- **Protocol Handler**: Improved Windows support by hiding CMD window on launch.

### Fixed
- **Hover Clipping**: Fixed issue where hover shadows were clipped by container overflow.
- **Model Names**: Fixed model naming convention to use dots instead of hyphens where appropriate.
- **Color Palette**: Refined neutral gray palette for better contrast.
- **MCP Parsing**: Fixed parsing for `mcpServers` wrapper format.

## [0.1.0] - 2024-01-01

### Initial Release
- **MCP Manager**: Toggle servers, add via npx, search/filter.
- **Skill/Plugin Editor**: Monaco-based editor for Markdown skills and JS/TS plugins.
- **Auth Manager**: OAuth login flow and API key management.
- **Protocol Handler**: Deep link support (`opencodestudio://`) for one-click installs.
- **Quickstart**: Guided onboarding flow.
- **Bulk Import**: Paste multiple URLs to import skills/plugins.
