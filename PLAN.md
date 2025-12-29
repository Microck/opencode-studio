# Opencode Studio

## Overview
Opencode Studio is a local GUI application designed to manage your Opencode configurations easily. It allows you to toggle MCP servers, edit skills, and manage plugins without manually editing JSON files.

## Architecture
- **Backend**: Node.js with Express.
  - Automatically detects your `~/.config/opencode` directory.
  - API endpoints to read/write `opencode.json` and modify files in `skill/` and `plugin/` directories.
- **Frontend**: React with Vite & Tailwind CSS.
  - Modern dark-themed dashboard.
  - Real-time configuration updates.

## Features
1. **MCP Manager**:
   - Visual toggle switches to enable/disable MCP servers.
   - Delete unused MCP configurations.
   - **Add new MCP servers**:
     - Supports `stdio` (Local) and `sse` (Remote) connection types.
     - Validates input fields before submission.
2. **Skill Editor**:
   - Browse existing skills in `.config/opencode/skill`.
   - Create new Markdown skill files.
   - Built-in text editor to modify skill content.
3. **Plugin Hub**:
   - View and edit local plugins in `.config/opencode/plugin`.
   - Create new plugin files.

## Installation & Usage

### Prerequisites
- Node.js installed.

### Setup
1. Navigate to the project directory:
   ```sh
   cd opencode-studio
   ```
2. Install dependencies (if not already done):
   ```sh
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

### Running the App
Start both the backend and frontend with a single command:
```sh
npm start
```
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
