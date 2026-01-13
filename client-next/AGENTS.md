# CLIENT-NEXT - Next.js 16 Frontend

## OVERVIEW

React 19 + Next.js 16 App Router frontend with shadcn/ui components.

## STRUCTURE

```
src/
├── app/           # Pages (App Router) - See app/AGENTS.md
├── components/    # See components/AGENTS.md
├── lib/           # Core Logic - See lib/AGENTS.md
│   ├── api.ts     # axios client → Express backend
│   ├── context.tsx# Global state (AppProvider)
│   └── utils.ts   # cn() helper
└── types/         # Shared TypeScript interfaces
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add page | `app/{name}/page.tsx` |
| Use shared state | `useApp()` hook from context.tsx |
| Call backend | Import from `@/lib/api` |
| Add type | `types/index.ts` |

## CONVENTIONS

- All pages are client components (`"use client"`)
- Global state via `useApp()` hook, not prop drilling
- API calls return typed responses, errors thrown
- Path alias: `@/` → `./src/`

## ANTI-PATTERNS

- Never use `fetch()` directly - use api.ts methods
- Never call backend without loading/error handling
- Never add server components that need runtime data

## NOTES

- Root page (`/`) redirects to `/mcp`
- Tailwind v4 config in `globals.css`, not separate file
- Fonts: Space Grotesk (sans), Commit Mono (mono)
