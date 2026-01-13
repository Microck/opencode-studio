# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-03
**Commit:** 62f3a34
**Branch:** master

## OVERVIEW

GUI for managing OpenCode CLI configs. Next.js 16 frontend + Express backend. Reads/writes `~/.config/opencode/`.

## STRUCTURE

```
opencode-studio/
├── client-next/         # Next.js 16 frontend (port 3000) - See client-next/AGENTS.md
├── server/              # Express API (port 3001) - See server/AGENTS.md
│   └── index.js         # 808 LOC - all backend logic
├── quickstart.bat/.sh   # One-click installers
└── package.json         # Monorepo runner (concurrently)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new page | `client-next/src/app/{page}/page.tsx` | App Router convention |
| Add API endpoint | `server/index.js` | All routes in single file |
| Add UI component | `client-next/src/components/` | shadcn/ui style |
| Modify shared state | `client-next/src/lib/context.tsx` | React Context |
| Add API client method | `client-next/src/lib/api.ts` | axios wrapper |
| TypeScript types | `client-next/src/types/index.ts` | All shared types |
| Config path detection | `server/index.js:CANDIDATE_PATHS` | OS-specific paths |
| Auth providers | `server/index.js:PROVIDER_DISPLAY_NAMES` | Add here + /api/auth/providers |

## CONVENTIONS

- **Subdirectory Next.js**: Frontend in `client-next/`, not root
- **No API routes**: All API via Express, not Next.js handlers
- **Tailwind v4**: Config in `globals.css` via `@theme inline`, not tailwind.config
- **shadcn/ui**: "new-york" style, CSS variables for theming
- **Studio config**: Separate `~/.config/opencode-studio/studio.json` for GUI prefs

## ANTI-PATTERNS (THIS PROJECT)

- Never add Next.js API routes - use Express server
- Never import from server/ in client-next/ (separate processes)
- Never hardcode config paths - use `getConfigDir()` for cross-OS
- Never modify opencode.json structure without updating types/index.ts

## UNIQUE STYLES

- Single-file backend: All Express routes in `server/index.js`
- Skill format: YAML frontmatter + markdown body, stored in `skill/{name}/SKILL.md`
- Plugin toggle: Tracked in studio.json, not opencode.json

## COMMANDS

```bash
# Development (both services)
npm start

# Frontend only
cd client-next && npm run dev

# Backend only
cd server && node index.js

# Quick install (creates deps + runs)
./quickstart.sh    # Unix
quickstart.bat     # Windows
```

## NOTES

- Root `/` redirects to `/mcp` (default page)
- Backend spawns `opencode auth login` for OAuth (opens browser)
- Bulk import limited to 50 URLs per request
- Config migration: root `providers` auto-moved to `model.providers`
