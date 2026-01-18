---
created: 2026-01-18T18:23
title: Fix Auth account pool CLIProxy integration
area: auth
files:
  - server/proxy-manager.js
  - client-next/src/components/account-pool-card.tsx
---

## Problem

The Auth account pool with CLIProxy has multiple issues:

1. **Accounts not adding up** - When adding accounts to the pool, they don't persist or accumulate correctly
2. **API calls not changing anything** - Backend API endpoints don't actually modify the account pool state
3. **No configuration** - Missing configuration options for the account pool/proxy system

Related prior work exists in `docs/plans/` but issues remain unresolved.

## Solution

TBD - Needs investigation of:
- `server/proxy-manager.js` for backend logic
- API endpoints handling account pool CRUD
- Frontend state sync with `account-pool-card.tsx`
- Configuration schema and persistence
