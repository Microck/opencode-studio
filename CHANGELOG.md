# Changelog

All notable changes to this project will be documented in this file.

## [1.14.5] - 2026-01-17

### Fixed
- **Proxy Config**: Version bump for npm publish.

## [1.14.5] - 2026-01-17

### Fixed
- **Proxy Config**: Version bump for npm publish.

## [1.14.7] - 2026-01-17

### Fixed
- **Proxy**: Version bump for npm publish.

## [1.14.8] - 2026-01-17

### Fixed
- **Proxy**: Version bump for npm publish.

## [1.14.7] - 2026-01-17

### Added
- **Auth UI**: Added "Active Accounts Pool" list to visualize available proxy accounts.
- **Proxy Config**: Enabled CORS in default proxy configuration.

## [1.14.5] - 2026-01-17

### Fixed
- **Proxy Config**: Version bump for npm publish.

## [1.14.4] - 2026-01-17

### Fixed
- **Proxy Config**: Explicitly disabled `management-key` in default configuration to prevent dashboard lockouts.

## [1.14.3] - 2026-01-17

### Fixed
- **System Prompt API**: Fixed 404 error caused by incorrect URL construction (`/api/api/...`).
- **Proxy Detection**: Robust fix for Windows `winget` alias `cli-proxy-api`.

## [1.14.2] - 2026-01-17

### Fixed
- **Proxy Detection**: Added explicit check for `cli-proxy-api` alias (used by WinGet) to fix detection issues on Windows.
- **Proxy Download**: Updated Windows download link to point to Releases page (stable URL).
- **System Prompt**: Fixed "Failed to save" error by ensuring the config directory exists before writing.

## [1.14.0] - 2026-01-17

### Added
- **Profile Manager**: Native multi-profile support (CCS-style isolation).
  - Create isolated environments (configs, history, sessions) in `~/.config/opencode-profiles/`.
  - Switch profiles instantly via the new "Profiles" tab.
  - Symlink-based architecture ensures compatibility with all OpenCode tools.

## [1.13.1] - 2026-01-17

### Fixed
- **Proxy Download**: Updated Windows download link to point to Releases page (stable URL).
- **System Prompt**: Fixed "Failed to save" error by ensuring the config directory exists before writing.

## [1.13.0] - 2026-01-17

### Added
- **Proxy Manager**: Full integration with **CLIProxyAPI** for automatic multi-account rotation and rate-limit handling.
  - **Dashboard**: Start/Stop the local proxy server directly from the Auth page.
  - **Account Management**: Add accounts for Google Antigravity, OpenAI Codex, and Anthropic via the proxy.
  - **One-Click Config**: Toggle "Enable Proxy" in Settings to automatically route OpenCode requests through the proxy.

### Changed
- **Auth UI**: Completely redesigned the Auth page to focus on Proxy management instead of manual account pools.
- **Architecture**: Shifted from client-side rotation to server-side proxying for better reliability.

## [1.12.14] - 2026-01-17

### Added
- **Auto-Sync Auth**: Automatic detection and pooling for all auth providers (including OpenAI).
- **JWT Extraction**: Support for extracting email addresses from OpenAI OAuth tokens for cleaner profile names.
- **Instant Activation**: Newly logged-in accounts are automatically set as active in the GUI.

## [1.12.13] - 2026-01-17

### Added
- **Antigravity Cooldowns**: Specialized cooldown presets for Google Antigravity accounts.
  - **Gemini 3 Pro**: 24-hour default cooldown.
  - **Claude Opus (GCP)**: 4-hour default cooldown.
- **UI Enhancements**: Antigravity-specific cooldowns are now highlighted and pinned to the top of the cooldown list.

## [1.12.12] - 2026-01-17

### Fixed
- **Auth Login**: Switched to interactive terminal login for all providers to bypass CLI bugs (e.g., OpenAI "fetch URL invalid" error).
- **Account Rotation**: Verified and stabilized multi-account rotation for Google and OpenAI pools.

## [1.3.1] - 2026-01-13

### Changed
- **Icons**: Updated application favicon and icons to new branding.

## [1.3.0] - 2026-01-13

### Added
- **Presets**: New feature to save and apply groups of Skills, Plugins, and MCPs.
  - **Presets Manager**: Access from Skills, Plugins, or MCP tabs.
  - **Partial Selection**: Choose exactly which items to include in a preset.
  - **Modes**: Apply presets in "Exclusive" (disable others) or "Additive" (keep others) mode.
- **Toggle API**: Added missing endpoints for toggling Skills and Plugins.

### Changed
- **Auth UI**: Refined palette (standardized colors) and descriptions.
- **Usage UI**: Fixed timeline locale, header alignment, and bottom spacing.
- **Commands**: Updated Edit icon to standard Pencil.
- **React Grab**: Hidden by default in production, toggle visibility with `F1`.

## [1.2.2] - 2026-01-13

### Added
- **Account Pool**: Manage multiple Google accounts with status tracking (Active, Ready, Cooldown).
- **Quota Visibility**: Real-time progress bar showing daily quota usage and reset time.
- **Rotation**: Manual rotation button to switch accounts when rate-limited.
- **Landing Page**: Added "Crime Scene" tape to indicate work-in-progress status.

### Changed
- **Logo Animation**: Adjusted logo entrance position (moved up 10px).

## [1.0.11] - 2026-01-05

### Added
- **One-Click Profile Switching**: Switch profiles by clicking anywhere on the row instead of a "Use" button.

### Fixed
- **Auth Verification**: Added content verification for active profiles to ensure UI reflects actual state after external login changes.

## [1.0.10] - 2026-01-05

### Fixed
- **Auth Profiles**: Fixed active profile detection. Now verifies that `auth.json` content actually matches the active profile content. If mismatch (e.g. after logging in to new account), active status is cleared so you can save the new account as a profile.

## [1.0.9] - 2026-01-05

### Fixed
- **Server Crash**: Restored missing `loadStudioConfig` and `saveStudioConfig` functions that caused ReferenceErrors.

## [1.0.8] - 2026-01-05

### Fixed
- **Server Startup**: Fixed `ReferenceError: getConfigDir is not defined` crash on startup.
- **Auth Path Detection**: Improved logging for auth file detection to help debugging.

## [1.0.7] - 2026-01-05

### Changed
- **Auth Login**: Opens terminal window for interactive `opencode auth login` instead of trying to spawn headlessly (opencode CLI requires interactive selection).

### Fixed
- **Landing Page Scroll**: Use fixed positioning to prevent scrolling on disconnected state.

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
