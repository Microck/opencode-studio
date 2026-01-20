# Architecture

**Analysis Date:** 2026-01-18

## Pattern Overview

**Overall:** Dual-process Monorepo (Next.js Frontend + Express Backend)

**Key Characteristics:**
- Separation of concerns: UI in Next.js, System IO in Express
- HTTP-based communication between processes
- File-based state management (`opencode.json`, `studio.json`)
- Single-file backend architecture for Express logic

## Layers

**Frontend Layer (`client-next/`):**
- Purpose: Provides user interface for managing configs
- Contains: React components, state hooks, API client
- Depends on: Backend API via Axios
- Used by: End user in browser

**Backend Layer (`server/`):**
- Purpose: Direct system access and config manipulation
- Contains: Route handlers, file IO, process spawning
- Depends on: Local file system, OpenCode CLI
- Used by: Frontend application

**Storage Layer:**
- Purpose: Persistent configuration
- Contains: `~/.config/opencode/opencode.json`, `~/.config/opencode-studio/studio.json`
- Depends on: Local disk
- Used by: Backend layer

## Data Flow

**Config Update Flow:**

1. User modifies a setting in the Next.js UI
2. `useApp()` hook updates local state
3. Frontend sends HTTP POST request via `@/lib/api` to `:3001`
4. Express `index.js` receives request and validates data
5. Backend performs atomic write to `opencode.json`
6. Success response returned to frontend

**State Management:**
- Global state in frontend via React Context (`AppProvider`)
- Persistent state on disk via JSON files
- No database; all data is local to the user's machine

## Key Abstractions

**AppProvider (`client-next/src/lib/context.tsx`):**
- Purpose: Centralized state for the entire frontend application
- Pattern: React Context with custom hooks

**API Client (`client-next/src/lib/api.ts`):**
- Purpose: Typed wrapper around Axios for backend calls
- Pattern: Singleton service

**Proxy Manager (`server/proxy-manager.js`):**
- Purpose: Manages the lifecycle of the CLIProxyAPI process
- Pattern: Node.js `child_process` wrapper

## Entry Points

**Frontend Entry:**
- Location: `client-next/src/app/page.tsx`
- Triggers: Browser access to `localhost:3000`
- Responsibilities: Redirect to `/mcp`, initialize app state

**Backend Entry:**
- Location: `server/index.js`
- Triggers: `node index.js` (usually via `npm start`)
- Responsibilities: Start Express server on port 3001, register routes

## Error Handling

**Strategy:** Frontend catches API errors and displays toast notifications. Backend returns appropriate HTTP status codes.

**Patterns:**
- Try/catch blocks around file operations in the backend
- `sonner` toasts in the frontend for user feedback
- Error boundaries for React component failures

## Cross-Cutting Concerns

**Logging:**
- Standard console logging in backend
- UI-based error reporting in frontend

**Authentication:**
- Proxy management for CLIProxyAPI
- OAuth handling for cloud sync providers

---

*Architecture analysis: 2026-01-18*
*Update when major patterns change*
