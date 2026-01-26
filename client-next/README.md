# Opencode Studio

Web GUI for managing [Opencode](https://github.com/opencode-ai/opencode) configuration.

## Features

- **MCP Servers**: Add/toggle/delete MCP servers. Paste npx commands directly.
- **Skills**: Create and edit skill files (markdown)
- **Plugins**: Create and edit plugin files (JS/TS)
- **Settings**: Manage model aliases
- **Raw Config**: Edit `opencode.json` directly

## Quick Start

```bash
# Start backend (auto-detects port, starting at 1920)
cd server && node index.js

# Start frontend (auto-detects port, starting at 1080)
cd client-next && npm run dev
```

Open http://localhost:1080

## Tech Stack

- Next.js 16 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Geist font

## Config Location

Reads/writes to `~/.config/opencode/opencode.json`
