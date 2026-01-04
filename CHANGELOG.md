# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

#### Multi-Account Auth Profiles
- Save multiple accounts per provider (e.g., 2 GitHub Copilot accounts)
- Switch between saved profiles instantly
- Auto-naming: profiles saved as `account-1`, `account-2`, etc.
- Rename and delete profile support
- Profile storage at `~/.config/opencode-studio/auth-profiles/`
- New API endpoints:
  - `GET /api/auth/profiles` - list all profiles
  - `GET /api/auth/profiles/:provider` - list provider profiles
  - `POST /api/auth/profiles/:provider` - save current auth as profile
  - `POST /api/auth/profiles/:provider/:name/activate` - switch account
  - `PUT /api/auth/profiles/:provider/:name` - rename profile
  - `DELETE /api/auth/profiles/:provider/:name` - delete profile

#### UI Animations
- Page fade-in transitions
- Card hover lift effects
- Collapsible section animations
- Staggered list item animations

### Changed
- **Removed Models tab** - settings now aligned with official opencode schema
- **Settings page cleanup:**
  - Removed Model Aliases section (not in opencode schema)
  - Removed logLevel field (not in schema)
  - Fixed permissions key: `permissions` → `permission` (per official docs)
  - Trimmed keybinds to 12 essentials (leader, app_exit, session_new, session_list, session_interrupt, input_submit, input_clear, input_newline, model_list, agent_cycle, messages_undo, messages_redo)
- **Types updated:** `OpencodeConfig.permission` (was `permissions`), added `provider` key

### Fixed
- Settings page now writes correct config keys per opencode official documentation

---

## [Previous]

### Added

#### Deep Link Protocol Support
- Protocol URL parsing in `cli.js` for `opencodestudio://` scheme
- Support for actions: `launch`, `install-mcp`, `import-skill`, `import-plugin`
- `?open=local` parameter to auto-open browser after backend start
- Pending action queue system (file + memory hybrid)
- `GET /api/pending-action` - retrieve queued action
- `POST /api/pending-action` - manually queue action
- `DELETE /api/pending-action` - clear pending action
- `PendingActionDialog` component with confirmation UI
- Security warnings for MCP commands and plugin imports
- Auto-navigation to relevant page after successful import
- `buildProtocolUrl()` helper in API client
- `PendingAction` TypeScript type

#### Public Site + Local Backend Mode
- `install.bat` and `install.sh` for dependency installation
- `start.bat` and `start.sh` for launching the app
- `GET /api/health` endpoint for connection detection
- `server/cli.js` - CLI entry point for `npx opencode-studio-server`
- `server/register-protocol.js` - registers protocol handler (Windows/Linux/macOS)
- `checkHealth()` function in frontend API
- Connection indicator in sidebar (green/red dot)
- "Launch Backend" button when disconnected
- Health polling every 3 seconds
- `connected` state in AppContext
- `.vercelignore` for Vercel deployment
- Standalone output in `next.config.ts`

### Changed
- Renamed provider prefix `copilot` → `github-copilot` across all pages
- `quickstart.bat/sh` now call install + start scripts
- Server CORS allows localhost and `*.vercel.app`
- `server/package.json` renamed to `opencode-studio-server` with bin/postinstall

### Fixed
- N/A

---

## How to Publish Server Package

### Prerequisites
- npm account (create at https://www.npmjs.com/signup)
- npm CLI logged in

### Steps

1. **Login to npm:**
   ```bash
   npm login
   ```
   Follow prompts for username, password, email, and 2FA if enabled.

2. **Verify login:**
   ```bash
   npm whoami
   ```
   Should show your npm username.

3. **Dry run (optional but recommended):**
   ```bash
   cd server
   npm publish --dry-run
   ```
   Review files that will be published.

4. **Publish:**
   ```bash
   cd server
   npm publish
   ```

5. **Verify publication:**
   ```bash
   npm view opencode-studio-server
   ```

### After Publishing

Users can install with:
```bash
npm install -g opencode-studio-server
```

And run with:
```bash
opencode-studio-server
```

Or register the protocol handler:
```bash
opencode-studio-server --register
```

### Updating the Package

1. Bump version in `server/package.json`
2. Update this changelog
3. Run `npm publish` from server directory

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `ENEEDAUTH` | Run `npm login` first |
| `E403 Forbidden` | Package name taken, or not logged in |
| `EPUBLISHCONFLICT` | Version already exists, bump version |
| `E402 Payment Required` | Scoped packages need `--access public` |
