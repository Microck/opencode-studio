# APP DIRECTORY - Next.js App Router Pages

## OVERVIEW

All routes use client components with shared state from `useApp()` context.

## STRUCTURE

```
app/
├── layout.tsx         # Root layout: ThemeProvider, AppProvider, AppShell wrapper
├── page.tsx           # / redirects to /mcp
├── globals.css        # Tailwind v4 theme config (@theme inline)
├── mcp/page.tsx       # MCP server management (toggle, add, delete)
├── skills/page.tsx    # Skill cards with bulk import
├── plugins/page.tsx   # Plugin cards, Gemini/Antigravity toggle detection
├── commands/page.tsx  # Slash command CRUD (stored in opencode.json)
├── auth/page.tsx      # OAuth providers, multi-account profiles
├── settings/page.tsx  # Permissions, agents, keybinds, TUI, backup/restore
├── config/page.tsx    # Raw JSON editor for opencode.json
├── usage/page.tsx     # Token usage dashboard with recharts
├── editor/page.tsx    # Shared editor for skills/plugins/commands
└── quickstart/page.tsx # Setup wizard with progress tracking
```

## WHERE TO LOOK

| Feature | File | Key Functions |
|---------|------|---------------|
| MCP toggle | `mcp/page.tsx` | `handleToggle()`, uses `toggleMCP` from context |
| Skill edit | `skills/page.tsx` → `editor/page.tsx` | Opens `/editor?type=skills&name=X` |
| Plugin edit | `plugins/page.tsx` → `editor/page.tsx` | Opens `/editor?type=plugins&name=X` |
| Bulk import | `skills/page.tsx`, `plugins/page.tsx` | `<BulkImportDialog>` component |
| Auth profiles | `auth/page.tsx` | Login/logout, save/switch credential profiles |
| Backup/restore | `settings/page.tsx` | `handleBackup()`, `handleRestore()` |
| Usage charts | `usage/page.tsx` | recharts `BarChart`, `PieChart` |
| Editor routing | `editor/page.tsx` | `?type=skills|plugins|commands&name=X` |

## CONVENTIONS

- All pages start with `"use client"` directive
- State comes from `useApp()` hook (see `lib/context.tsx`)
- API calls via `@/lib/api` (axios wrapper to Express backend)
- Toast notifications via `sonner` (`toast.success()`, `toast.error()`)
- Tailwind v4: theme defined in `globals.css` with `@theme inline`, not separate config
- Collapsible sections use shadcn `<Collapsible>` pattern (see `settings/page.tsx`)
- Loading states use `<Skeleton>` components
- Delete confirmations use `<AlertDialog>`

## ROUTING NOTES

- Root `/` is a server component that `redirect("/mcp")`
- `/editor` is shared: query params determine content type
- No dynamic `[slug]` routes; all static paths
