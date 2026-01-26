# SERVER LAYER

Express API backend (port 1920). Single-file architecture.

## STRUCTURE

| File | Purpose |
|------|---------|
| `index.js` | All routes, config IO, auth, skills, plugins, usage stats |
| `cli.js` | npm bin entry, protocol URL parser, pending action queue |
| `register-protocol.js` | OS-specific `opencodestudio://` handler registration |

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add API endpoint | `index.js` - add `app.get/post/delete` |
| Config path detection | `index.js:getPaths()` - `CANDIDATE_PATHS` logic |
| Auth profile management | `index.js:440-620` - profiles CRUD |
| Google plugin switching | `index.js:803-860` - gemini/antigravity toggle |
| Usage stats aggregation | `index.js:687-800` - reads message storage |
| Protocol actions | `cli.js:34-84` - switch on action type |
| Windows registry | `register-protocol.js:8-55` |

## CONVENTIONS

- All routes in single file (no route modules)
- Studio prefs in `~/.config/opencode-studio/studio.json`, separate from opencode config
- Auth profiles namespaced: `google.gemini`, `google.antigravity`
- 30min idle timeout auto-shutdown

## ANTI-PATTERNS

- Hardcoding `~/.config/opencode` - use `getPaths().current`
- Importing from `client-next/` - separate processes
- Adding Next.js API routes - all API here
- Modifying opencode.json structure without updating `client-next/src/types/`
