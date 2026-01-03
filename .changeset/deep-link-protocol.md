---
"opencode-studio": minor
---

Add deep link support for one-click MCP/skill/plugin installs from external sites.

Protocol formats:
- `opencodestudio://launch` - start backend
- `opencodestudio://launch?open=local` - start backend + browser
- `opencodestudio://install-mcp?name=X&cmd=Y` - install MCP server
- `opencodestudio://import-skill?url=X` - import skill from URL
- `opencodestudio://import-plugin?url=X` - import plugin from URL

Changes:
- cli.js: Parse protocol URLs and queue pending actions
- server: Add /api/pending-action endpoints (GET/POST/DELETE)
- frontend: Poll for pending actions on connect, show confirmation dialog
- New PendingActionDialog component with security warnings
- Rename "copilot" provider prefix to "github-copilot"
