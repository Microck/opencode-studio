# Technology Stack

**Analysis Date:** 2026-01-18

## Languages

**Primary:**
- TypeScript 5.x - Frontend application code (`client-next/`)
- JavaScript (Node.js) - Backend server code (`server/`)

**Secondary:**
- CSS (Tailwind v4) - Component styling
- Bash/Batch - Quickstart scripts (`quickstart.sh`, `quickstart.bat`)

## Runtime

**Environment:**
- Node.js 20.x+ - Required for both frontend and backend
- Browser - Required for Next.js UI

**Package Manager:**
- npm - Used across the monorepo
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.1 - Frontend framework (App Router)
- React 19.2.3 - UI library
- Express 5.2.1 - Backend API server

**Testing:**
- None - No testing framework currently implemented

**Build/Dev:**
- Tailwind CSS v4 - Styling engine
- TypeScript 5.x - Static typing
- ESLint 9.x - Linting

## Key Dependencies

**Critical:**
- `lucide-react` 0.562.0 - Icon set
- `zustand` 5.0.9 - Frontend state management
- `axios` 1.13.2 - HTTP client for API communication
- `@monaco-editor/react` 4.7.0 - Code editor for skills and plugins

**Infrastructure:**
- `concurrently` 9.2.1 - Runs frontend and backend processes simultaneously
- `cors` 2.8.5 - Enables cross-origin requests between frontend and backend
- `body-parser` 2.2.1 - Parses incoming request bodies in Express

## Configuration

**Environment:**
- No `.env` files detected in root; configuration likely handled via studio.json or CLI flags.

**Build:**
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint flat configuration
- `next.config.ts` - Next.js configuration

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js installed
- OpenCode CLI must be installed and configured

**Production:**
- Can be installed globally via npm as `opencode-studio-server`
- Local hosting recommended for privacy and config access

---

*Stack analysis: 2026-01-18*
*Update after major dependency changes*
