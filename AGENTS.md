# AGENTS.md

Local GUI for managing OpenCode configurations. Two-package monorepo.

## Structure

| Path | Stack | Entry |
|------|-------|-------|
| `server/` | Express.js, CommonJS, Node.js | `index.js` (5500+ line monolith) |
| `client-next/` | Next.js 16, React 19, TypeScript strict | App Router in `src/app/` |

Path alias in client: `@/*` → `./src/*`

## Commands

```bash
npm install          # installs both packages (postinstall hooks)
npm start            # runs both: backend :1920+, frontend :1080+
npm run build        # builds client-next only

# Lint (client only)
cd client-next && npm run lint

# Tests (server only, single file)
cd server && npx vitest run lib/config-providers.test.js
```

Ports auto-increment if occupied.

## Config Paths (managed by server)

- OpenCode: `~/.config/opencode/`
- Studio data: `~/.config/opencode-studio/`
- Profiles: `~/.config/opencode-profiles/`

## Key Conventions

**Server:**
- Plain JavaScript (CommonJS, no TS)
- Uses `atomicWriteFileSync()` for safe file writes - always use it
- `ERROR_CODES` object at top of index.js defines all error constants
- JSONC parsing via `jsonc-parser` (allows comments/trailing commas)

**Client:**
- TypeScript strict, ESLint with next/core-web-vitals + next/typescript
- Tailwind CSS v4, Radix UI primitives, Zustand for state
- i18n via next-intl: translations in `messages/{locale}.json`
- Add new locales in `src/i18n/request.ts`

## Adding Features

**New page:** Create `src/app/{route}/page.tsx`, add nav entry in `sidebar.tsx`

**New i18n keys:** Add to all `messages/*.json` files (en.json, zh-CN.json)

**Server endpoints:** Add to `server/index.js` (no router splitting)
