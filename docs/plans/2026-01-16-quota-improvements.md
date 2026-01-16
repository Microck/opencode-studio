# Quota Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to set custom daily quota limits and automatically detect 429/exhaustion events from logs.

**Architecture:**
- **Store:** `pool-metadata.json` stores `dailyLimit` per provider.
- **Watcher:** Detects `429` or `quota exceeded` in logs -> updates metadata to mark "exhausted" or sets limit to current usage.
- **UI:** Add "Edit Limit" button/dialog to `AccountPoolCard`.

**Tech Stack:** Next.js, Express, Log Watcher (Node.js)

---

### Task 1: Adaptive Log Watcher

**Files:**
- Modify: `server/index.js` (Log Watcher `processLogLine`)

**Step 1: Detect 429**
- Regex: `status=429` or `error=.*quota.*exceeded`.
- Action: If detected, find `providerID`.
- Update `metadata._quota[namespace].exhausted = true`.
- Update `metadata._quota[namespace].dailyLimit = Math.max(usage, dailyLimit)`.

### Task 2: Server API for Limits

**Files:**
- Modify: `server/index.js`

**Step 1: POST /api/auth/pool/limit**
- Body: `{ provider: string, limit: number }`
- Action: Update `metadata._quota[namespace].dailyLimit`.

### Task 3: UI for Limits

**Files:**
- Modify: `client-next/src/components/account-pool-card.tsx`
- Modify: `client-next/src/app/auth/page.tsx`

**Step 1: Add Edit Button**
- Small "pencil" icon next to "Daily Quota: 100% remaining".
- Opens Dialog to enter number.

**Step 2: Connect API**
- Call `savePoolLimit`.

---

**Execution Order:**
1. Adaptive Watcher
2. Server API
3. UI
