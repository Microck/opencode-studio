# External Integrations

**Analysis Date:** 2026-01-18

## APIs & External Services

**OpenCode CLI:**
- Primary integration for managing MCP servers and skills
- Interaction via spawned processes and direct config file manipulation

**OAuth Providers:**
- Google, Anthropic, OpenAI
- Used for authentication within the OpenCode ecosystem

**Cloud Sync:**
- Dropbox and Google Drive
- Provides remote backup and cross-device synchronization for configurations

## Data Storage

**Config Files:**
- `~/.config/opencode/opencode.json` - Main CLI configuration
- `~/.config/opencode-studio/studio.json` - GUI preferences and cloud sync settings

**Skill Storage:**
- `~/.config/opencode/skill/` - Markdown-based skill files

**Plugin Storage:**
- `~/.config/opencode/plugin/` - JavaScript/TypeScript plugin files

## Authentication & Identity

**CLIProxyAPI:**
- Manages authentication pools for multiple providers
- Handles automatic rotation on quota exhaustion
- Proxy dashboard integration

## Monitoring & Observability

**Usage Analytics:**
- Real-time log parsing of OpenCode activity
- Tracks token usage, costs, and request patterns per provider/model

## CI/CD & Deployment

**Hosting:**
- Locally hosted (localhost:3000/3001)
- Global install via npm (`opencode-studio-server`)

## Environment Configuration

**Development:**
- Port 3000 (Frontend)
- Port 3001 (Backend)
- Automatic config directory detection (`~/.config/opencode`)

---

*Integration audit: 2026-01-18*
*Update when adding/removing external services*
