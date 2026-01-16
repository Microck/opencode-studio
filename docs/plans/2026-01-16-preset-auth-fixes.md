# Preset UI + Auth Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix preset creation UI bugs (layout, toggles), improve Auth UI (profile rename), and verify quota/multi-auth behavior.

**Architecture:** 
- **UI Fixes:** Modify `presets-manager.tsx` to fix toggle logic and dialog layout.
- **Auth Fixes:** Update `client-next/src/app/auth` and `server/index.js` to support renaming and verify calculations.

**Tech Stack:** Next.js, React, Tailwind CSS, Express

---

### Task 1: Fix Preset UI Layout & Toggles

**Files:**
- Modify: `client-next/src/components/presets-manager.tsx`

**Step 1: Fix toggle logic**
- Currently, toggles inside lists are disabled when the main category switch is OFF (`!includeSkills`).
- **Bug:** `disabled={!includeSkills}` prevents user from selecting individual items even if they want to build a custom set.
- **Fix:** Keep individual toggles enabled but maybe grayed out? OR fix the `includeSkills` logic to just be a "Select All" / "Deselect All" helper instead of a gatekeeper.
- **Decision:** The user said "Cannot toggle skills or plugins". This suggests individual switches aren't working. The code shows `disabled={!includeSkills}`. I will remove the `disabled` prop and make the header switch toggle ALL on/off, but allow individual toggles always.

**Step 2: Fix Layout (Vertical -> Horizontal)**
- **Issue:** "Create preset popup is still vertical. Make it be horizontal".
- **Current:** `grid-cols-1 md:grid-cols-3` inside a `max-w-[98vw]`. This *should* be horizontal on desktop.
- **Diagnosis:** Maybe the dialog width isn't triggering the grid breakpoint, or the user wants a different layout. I will force a wider layout or ensure `grid-cols-3` applies correctly.
- **Refinement:** The dialog has `max-w-[98vw] w-[1800px]`. It should be wide. I'll inspect the grid class `grid-cols-1 md:grid-cols-3`. Maybe the user sees it on a smaller screen? I'll ensure it respects width.

**Step 3: Implementation**
- Modify `PresetsManager` to improve toggle UX and ensure horizontal layout.

### Task 2: Auth Profile Rename

**Files:**
- Modify: `server/index.js` (add rename endpoint if missing)
- Modify: `client-next/src/app/auth/page.tsx` (add rename UI)
- Modify: `client-next/src/lib/api.ts` (add client method)

**Step 1: Check server support**
- `server/index.js` has `app.put('/api/auth/profiles/:provider/:name', ...)`? I saw `app.put` in grep earlier. I need to verify it implements RENAME.
- If missing, implement `PUT /api/auth/profiles/:provider/:name` to rename the file and update metadata.

**Step 2: Add UI**
- Add "Rename" option to the profile dropdown in `AccountPoolCard` or profile list.
- Trigger a small dialog or prompt to get new name.

### Task 3: Verify Quota & Multi-Auth

**Files:**
- Read: `server/index.js` (quota logic)

**Step 1: Analyze Quota Logic**
- How is `quota` calculated?
- Does it track `usageCount` correctly?
- Does it respect `dailyLimit`?

**Step 2: Verify Multi-Auth**
- How does `antigravity` vs `gemini` plugin switching work?
- Ensure the pool logic handles both correctly.

**Step 3: Explanation**
- Write a short summary explaining how quota and multi-auth work to the user.

---

**Execution Order:**
1. Fix Preset UI (Toggles + Layout)
2. Implement Auth Rename
3. Analyze & Explain Quota/Multi-Auth
