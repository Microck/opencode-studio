# Coding Conventions

**Analysis Date:** 2026-01-18

## Naming Patterns

**Files:**
- kebab-case for component files (`mcp-card.tsx`)
- camelCase for library and utility files (`api.ts`, `utils.ts`)
- All lowercase for main system files (`index.js`, `cli.js`)

**Functions:**
- camelCase for all functions and logic
- PascalCase for React components

**Variables:**
- camelCase for variables and parameters
- UPPER_SNAKE_CASE for constants and environment variables

**Types:**
- PascalCase for interfaces and type aliases
- No 'I' prefix for interfaces

## Code Style

**Formatting:**
- 2-space indentation
- Semicolons used in frontend, consistent in backend
- Single quotes for strings preferred in frontend

**Linting:**
- ESLint 9.x with flat config in frontend
- Next.js core web vitals rules enabled

## Import Organization

**Order:**
1. External packages (react, next, lucide-react)
2. Internal library modules (`@/lib/api`, `@/lib/context`)
3. Component imports (`@/components/...`)
4. Type imports

**Path Aliases:**
- `@/` maps to `client-next/src/`

## Error Handling

**Patterns:**
- Try/catch blocks around asynchronous API calls and file operations
- Descriptive error messages passed to user via toasts
- Graceful degradation if backend is unavailable

## Logging

**Framework:**
- `console.log` and `console.error` for system-level logging
- UI notifications for user-facing errors

## Comments

**When to Comment:**
- Explain complex logic or system workarounds
- Document OS-specific paths and permissions
- Tag TODOs for future improvements (though none currently found)

## Function Design

**Size:**
- Aim for small, focused components in React
- Backend routes handled directly in `index.js`, but logic should be extractable if complex

**Parameters:**
- Destructuring preferred for component props
- Typed parameters for all internal functions

## Module Design

**Exports:**
- Named exports preferred for utilities and types
- Default exports used for Next.js pages and some components

---

*Convention analysis: 2026-01-18*
*Update when patterns change*
