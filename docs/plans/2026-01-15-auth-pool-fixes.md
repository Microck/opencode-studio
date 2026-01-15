# auth pool fixes implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** fix add/remove accounts, pool labeling, cooldown cues, and quota/usage tracking so auth pool works end to end.

**Architecture:** update express auth/pool routes to store email metadata, create profiles on oauth, and clean up logout/remove. update auth ui to surface pool actions and cooldown visuals, and keep oauth add flow from getting stuck.

**Tech Stack:** Next.js 16, React, shadcn/ui, Express

---

### task 1: trace add/logout failures

**Files:**
- Modify: `server/index.js`
- Modify: `client-next/src/app/auth/page.tsx`
- Modify: `client-next/src/components/account-pool-card.tsx`

**Step 1: capture current behavior**

Run: click add account and logout in `/auth`
Expected: reproduce stuck add state and missing logout

**Step 2: define target behavior**

- add account creates a profile entry and shows email when available
- remove account clears profile file and active selection
- cooldown shows a clear visual state

### task 2: backend profile + metadata fixes

**Files:**
- Modify: `server/index.js`

**Step 1: write failing check**

Run: add google account, then fetch `/api/auth/pool`
Expected: new account missing email and no profile file

**Step 2: implement minimal fix**

- create profile file on google oauth success
- store email/createdAt in pool metadata
- use profile file email if metadata missing
- clear auth + metadata when deleting active profile
- set login cwd to config dir

**Step 3: verify**

Run: add account and refresh `/auth`
Expected: pool entry appears with email

### task 3: ui fixes for pool actions and labels

**Files:**
- Modify: `client-next/src/components/account-pool-card.tsx`
- Modify: `client-next/src/app/auth/page.tsx`

**Step 1: write failing check**

Run: click add account, wait 2 min, try again
Expected: button stays disabled

**Step 2: implement minimal fix**

- clear google oauth loading state on timeout/error
- add remove account action in pool menu
- show cooldown timer even if status not cooldown
- add cooldown row background
- align pool card title to `${provider} pool`

**Step 3: verify**

Run: add account, mark cooldown, remove account
Expected: button enabled, cues visible, account removed

### task 4: quota/usage tracking touches

**Files:**
- Modify: `server/index.js`
- Modify: `client-next/src/app/auth/page.tsx`

**Step 1: write failing check**

Run: rotate account, quota stays unchanged
Expected: usage count increments

**Step 2: implement minimal fix**

- increment usage on activate/rotate
- refresh pool after usage increment

**Step 3: verify**

Run: rotate and activate accounts
Expected: usage count and quota move

---

plan complete. proceed with implementation in this session.
