# Opencode Studio

## Overview
Opencode Studio is a local GUI application designed to manage your Opencode configurations easily. It allows you to toggle MCP servers, edit skills, manage plugins, and handle authentication without manually editing JSON files.

## Architecture
- **Backend**: Node.js with Express.
  - Automatically detects your `~/.config/opencode` directory.
  - API endpoints to read/write `opencode.json` and modify files in `skill/` and `plugin/` directories.
- **Frontend**: Next.js 16 with shadcn/ui and Tailwind CSS (located in `client-next`).
  - Dark/light theme support with system preference detection.
  - Real-time configuration updates via centralized context.

## Features
1. **MCP Manager**:
   - Visual toggle switches to enable/disable MCP servers.
   - Delete unused MCP configurations with confirmation dialogs.
   - Add new MCP servers with command parsing and environment variable support.
   - Search/filter MCP servers.
2. **Skill Editor**:
   - Browse and edit skills in `.config/opencode/skill`.
   - Create new skills from templates with YAML frontmatter.
   - Import skills from URL (paste raw GitHub links).
   - Search/filter skills by name or description.
3. **Plugin Hub**:
   - View and edit local JS/TS plugins in `.config/opencode/plugin`.
   - Multiple plugin templates: Basic, Tool Hooks, File Watcher, Message Hooks, Session Lifecycle, Git Hooks.
   - Import plugins from URL.
   - Search/filter plugins.
4. **Authentication**:
   - View connected AI providers (GitHub Copilot, Google, Anthropic, etc.).
   - Login to new providers via browser OAuth or API key.
   - Remove provider credentials.
   - Track token expiration status.
5. **Settings**:
   - Manage global configuration, model aliases, permissions, and agent settings.
   - Backup and restore configurations.
   - Dark/light theme toggle.

## Quickstart

To get up and running immediately, use the provided quickstart scripts:

**Windows:**
```batch
quickstart.bat
```

**macOS / Linux:**
```bash
chmod +x quickstart.sh
./quickstart.sh
```

## Screenshots

### MCP Manager
![MCP Manager Dashboard](docs/screenshots/mcp-manager.png)

### Skill Editor
![Skill Editor](docs/screenshots/skill-editor.png)

### Authentication
![Authentication](docs/screenshots/auth.png)

### Settings
![Settings Page](docs/screenshots/settings.png)

## Installation & Usage

### Prerequisites
- Node.js installed.

### Setup
1. Navigate to the project directory:
   ```sh
   cd opencode-studio
   ```
2. Install dependencies:
   ```sh
   npm install
   cd client-next && npm install
   cd ../server && npm install
   ```

### Running the App
Start both the backend and frontend with a single command:
```sh
npm start
```
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
