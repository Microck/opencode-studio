# Integrations

## External APIs & Services
- **OpenCode CLI**: Core functionality integration
  - Spawns `opencode auth login` for OAuth authentication
  - Reads/writes ~/.config/opencode/opencode.json
  - Manages MCP servers, skills, plugins, and commands
- **OAuth Providers**: Authentication via external services
  - Google (Gemini/Antigravity plugins)
  - Anthropic (Claude)
  - OpenAI
  - Other providers via CLIProxyAPI
- **Dropbox API**: Cloud synchronization
  - Upload/download config backups
  - OAuth-based authentication
- **Google Drive API**: Alternative cloud sync
  - File upload/download for config backups
  - OAuth-based authentication
- **CLIProxyAPI**: Multi-account proxy management
  - Account rotation for rate limit handling
  - Proxy status monitoring
  - Login command execution

## File System & Data Storage
- **Main Config**: ~/.config/opencode/opencode.json
  - MCP server configurations
  - Model providers and aliases
  - Agent settings and permissions
  - Plugin and skill references
- **Studio Config**: ~/.config/opencode-studio/studio.json
  - GUI preferences (disabled skills/plugins)
  - Active profiles and presets
  - Cloud sync settings
- **Authentication**: ~/.config/opencode/auth.json
  - OAuth tokens and credentials
  - Profile-based auth management
- **Skills Directory**: ~/.config/opencode/skill/
  - Individual subdirectories per skill
  - SKILL.md files with YAML frontmatter + markdown content
- **Plugins Directory**: ~/.config/opencode/plugin/
  - JavaScript/TypeScript plugin files
  - NPM package references in config
- **Log Files**: ~/.local/share/opencode/log/
  - Usage tracking and statistics
  - Automatic account rotation based on rate limits
- **Antigravity Accounts**: ~/.config/opencode/antigravity-accounts.json
  - Multi-account pool for Antigravity service

## Protocols & Deep Linking
- **Custom Protocol Handler**: opencodestudio://
  - Install MCP servers: `opencodestudio://install-mcp?name=NAME&cmd=COMMAND`
  - Import skills: `opencodestudio://import-skill?url=URL`
  - Import plugins: `opencodestudio://import-plugin?url=URL`
  - Launch backend: `opencodestudio://launch`

## Data Import/Export
- **Bulk URL Import**: Fetch from GitHub raw URLs
  - Skills from raw.githubusercontent.com
  - Plugins from raw.githubusercontent.com
  - Preview and selective import
- **Backup/Restore**: Complete config export
  - Includes studio config, opencode config, skills, plugins
  - JSON format for cloud storage
- **Cloud Sync**: Automatic or manual synchronization
  - Dropbox or Google Drive integration
  - Pull on startup if remote newer
  - Push after config changes

## Model Context Protocol (MCP)
- **MCP Servers**: External AI model integrations
  - Local command execution
  - SSE (Server-Sent Events) connections
  - Remote URL endpoints
  - OAuth authentication for MCP servers

## Usage Tracking & Analytics
- **Log Parsing**: Real-time monitoring of ~/.local/share/opencode/log/
  - LLM usage statistics by provider/model
  - Cost and token tracking
  - Automatic account rotation on rate limits
- **Quota Management**: Daily usage limits and monitoring
  - Per-provider quota tracking
  - Account cooldown and rotation logic

## Development & Build
- **Concurrent Development**: npm start runs both frontend and backend
- **Protocol Registration**: OS-specific handler registration for deep links
- **Version Checking**: Backend version compatibility with frontend
