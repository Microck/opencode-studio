# Codebase Structure

**Analysis Date:** 2026-01-18

## Directory Layout

```
opencode-studio/
├── client-next/         # Next.js 16 frontend
│   ├── src/             # Source code
│   │   ├── app/         # Pages and routes
│   │   ├── components/  # UI components (shadcn/ui)
│   │   ├── lib/         # API client and context
│   │   └── types/       # TypeScript definitions
│   └── public/          # Static assets
├── server/              # Express backend
│   ├── index.js         # Core API logic
│   ├── proxy-manager.js # Proxy process management
│   ├── cli.js           # CLI entry and protocol handler
│   └── register-protocol.js # Protocol registration
├── quickstart.sh/.bat   # Setup scripts
├── package.json         # Root monorepo config
└── README.md            # Project documentation
```

## Directory Purposes

**client-next/src/app/:**
- Purpose: Application pages using Next.js App Router
- Contains: `page.tsx` files for each route (mcp, skills, plugins, etc.)
- Key files: `layout.tsx` (app shell), `mcp/page.tsx` (default view)

**client-next/src/components/:**
- Purpose: Reusable UI elements
- Contains: shadcn/ui components and feature-specific components
- Key files: `app-shell.tsx`, `mcp-card.tsx`

**server/:**
- Purpose: Backend API logic and system integration
- Contains: Express server and helper scripts
- Key files: `index.js` (800+ lines of logic), `cli.js` (CLI interactions)

## Key File Locations

**Entry Points:**
- `client-next/src/app/page.tsx`: Frontend root
- `server/index.js`: Backend root
- `server/cli.js`: CLI/npm bin entry

**Configuration:**
- `package.json`: Root runner (concurrently)
- `client-next/tsconfig.json`: Frontend TS config
- `server/package.json`: Backend dependencies

**Core Logic:**
- `server/index.js`: All API routes and file IO
- `client-next/src/lib/context.tsx`: Global frontend state

## Naming Conventions

**Files:**
- `kebab-case.tsx` for components
- `camelCase.ts` for utilities
- `index.js` for main backend entry

**Directories:**
- `kebab-case` for all directories
- Plural names for collections (`components`, `types`)

## Where to Add New Code

**New Feature (UI):**
- Primary code: `client-next/src/app/{feature}/page.tsx`
- Components: `client-next/src/components/`

**New API Endpoint:**
- Implementation: `server/index.js` (add route handler)

**New Type Definition:**
- Path: `client-next/src/types/index.ts`

**Shared Utility:**
- Frontend: `client-next/src/lib/utils.ts`
- Backend: `server/` (new module if complex, otherwise `index.js`)

## Special Directories

**.planning/:**
- Purpose: Project initialization and roadmap tracking
- Source: Managed by OpenCode GSD workflow
- Committed: Yes

---

*Structure analysis: 2026-01-18*
*Update when directory structure changes*
