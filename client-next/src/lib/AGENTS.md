# LIB KNOWLEDGE BASE

Core frontend logic: API client, global state, utilities.

## STRUCTURE

```
lib/
├── api.ts           # 322 LOC - axios wrapper, all backend calls
├── context.tsx      # 244 LOC - AppProvider + useApp hook
├── utils.ts         # 26 LOC - cn(), formatCurrency(), formatTokens()
├── store/
│   └── filters.ts   # 20 LOC - Zustand store for usage page filters
└── data/
    └── pricing.ts   # 44 LOC - LLM pricing constants + cost calculators
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add API endpoint call | `api.ts` | Add typed async function using `api` axios instance |
| Add global state | `context.tsx` | Add to AppContextType, update AppProvider |
| Add MCP action | `context.tsx` | toggleMCP, deleteMCP, addMCP, updateMCP exist |
| Add Tailwind class merge | `utils.ts` | Use `cn()` helper |
| Add usage page filter | `store/filters.ts` | Extend Zustand store |
| Add LLM pricing | `data/pricing.ts` | Add to PRICING_PER_1M map |

## API METHODS (api.ts)

**Config:** `getConfig()`, `saveConfig()`, `getPaths()`, `setConfigPath()`
**Skills:** `getSkills()`, `getSkill()`, `saveSkill()`, `deleteSkill()`, `toggleSkill()`
**Plugins:** `getPlugins()`, `getPlugin()`, `savePlugin()`, `deletePlugin()`, `togglePlugin()`
**Commands:** `getCommand()`, `saveCommand()`, `deleteCommand()`
**Auth:** `getAuthInfo()`, `getAuthProviders()`, `authLogin()`, `authLogout()`, `getAuthProfiles()`, `saveAuthProfile()`, `activateAuthProfile()`
**Usage:** `getUsageStats(projectId?, granularity?, range?)`
**Utils:** `fetchUrl()`, `bulkFetchUrls()`, `getBackup()`, `restoreBackup()`, `checkHealth()`
**Deep Links:** `PROTOCOL_URL`, `buildProtocolUrl()`, `getPendingAction()`, `clearPendingAction()`

## GLOBAL STATE (context.tsx)

```tsx
const { config, skills, plugins, loading, error, connected, pendingAction } = useApp();
const { refreshData, saveConfig, toggleMCP, deleteMCP, addMCP, updateMCP, toggleSkill, togglePlugin, dismissPendingAction } = useApp();
```

## CONVENTIONS

- **API base:** `NEXT_PUBLIC_API_URL` env or `http://127.0.0.1:3001/api`
- **axios instance:** Pre-configured, exported as default + named methods
- **Context pattern:** Must wrap app in `<AppProvider>`, access via `useApp()`
- **MCP sanitization:** `sanitizeMCPConfig()` normalizes args→command, env→environment
- **Health polling:** Context polls `/health` every 3s, auto-refreshes on reconnect
- **Zustand stores:** Minimal, single-purpose (filters only currently)
- **cn() helper:** Always use for conditional Tailwind classes

## ANTI-PATTERNS

- Never call `api` axios directly outside api.ts - use exported functions
- Never access context outside AppProvider - will throw
- Never add complex state to Zustand - use React Context for app state
