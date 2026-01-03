# OpenCode Studio - Public Site + Protocol Handler

## Goal
Dual mode support:
1. **Local mode**: Full local dev (current behavior)
2. **Public mode**: Vercel site + local backend via `opencode-studio://` protocol

---

## Phase 1: Script Refactoring
- [x] Create `install.bat` - Windows dependency installation
- [x] Create `start.bat` - Windows launch (frontend + backend)
- [x] Create `install.sh` - Unix dependency installation
- [x] Create `start.sh` - Unix launch (frontend + backend)
- [x] Update `quickstart.bat` - calls install.bat + start.bat
- [x] Update `quickstart.sh` - calls install.sh + start.sh
- [x] Test scripts on Windows

---

## Phase 2: Server Enhancements
- [x] Add `GET /api/health` endpoint to `server/index.js`
- [x] Configure CORS to allow Vercel domain + localhost
- [x] Create `server/cli.js` - CLI entry point for npx
- [x] Create `server/register-protocol.js` - protocol registration (opencode-studio://)
- [x] Update `server/package.json`:
  - Add `bin` field for CLI
  - Add `postinstall` script for protocol registration
  - Add npm publish metadata
- [x] Test protocol registration locally

---

## Phase 3: Frontend Connection UI
- [x] Add `checkHealth()` function to `client-next/src/lib/api.ts`
- [x] Add `connectionStatus` state to context (`client-next/src/lib/context.tsx`)
- [x] Create `ConnectionStatus` component with:
  - Green dot when connected
  - Red dot + "Launch Backend" button when disconnected
  - "Launch Backend" triggers `opencodestudio://launch`
- [x] Add connection indicator to sidebar
- [x] Environment detection: local (localhost:3000) vs public (Vercel)
- [x] Auto-poll health endpoint every 3s
- [x] Handle CORS errors gracefully (backend not running)

---

## Phase 4: Deployment Prep
- [x] Update `client-next/next.config.ts` for Vercel deployment
- [x] Set `NEXT_PUBLIC_API_URL=http://localhost:3001/api` in Vercel env
- [x] Create `.vercelignore` to exclude server/
- [x] Test local build: `npm run build` in client-next

---

## Phase 5: Publish & Deploy
- [ ] **BLOCKED - REQUIRES USER:** Create npm account (https://www.npmjs.com/signup)
- [ ] **BLOCKED - REQUIRES USER:** Login: `npm login`
- [ ] **BLOCKED - REQUIRES USER:** Publish server: `cd server && npm publish`
- [x] Deploy frontend: `cd client-next && npx vercel`
- [x] Set env var in Vercel: `NEXT_PUBLIC_API_URL=http://localhost:3001/api`
- [x] Test full public flow (partial - frontend works, backend needs npm publish)

**Deployed URL:** https://client-next-nu.vercel.app

**To complete npm publish, run:**
```
npm login
cd server && npm publish
```

---

## Phase 6: Documentation
- [x] Update README.md with new dual-mode usage
- [x] Add troubleshooting for protocol registration issues
- [x] Document npm package usage

---

## Notes
- Protocol: `opencode-studio://launch`
- npm package: `opencode-studio-server`
- All existing functionality preserved
- Local mode unchanged (npm start works as before)
