# Log Watcher Service Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide accurate quota/usage tracking by parsing OpenCode logs in real-time, instead of relying on manual rotation clicks.

**Architecture:**
- **Watcher:** A background service in `server/index.js` that watches `~/.local/share/opencode/log/`.
- **Parser:** Reads new lines, looks for request signatures (e.g., `POST https://generativelanguage.googleapis.com` or `[gemini]`).
- **Store:** Updates `pool-metadata.json` with actual usage counts.
- **UI:** Updates `AccountPoolCard` to show "Real Usage" vs "Estimated".

**Tech Stack:** Node.js `fs.watch`, `readline`

---

### Task 1: Analyze Log Format

**Files:**
- Read: `~/.local/share/opencode/log/*.log` (sample)

**Step 1: Get samples**
- Read recent logs to find what a Gemini/Antigravity request looks like.
- Identify patterns for:
  - Request start
  - Model used
  - Success/Failure

### Task 2: Implement Watcher

**Files:**
- Modify: `server/index.js`

**Step 1: File Watcher**
- Watch directory for new log files.
- Tail the latest active log file.

**Step 2: Line Parser**
- Regex for usage.
- Increment `metadata._quota[namespace][today]`.
- Save metadata (throttled).

### Task 3: Integrate & Verify

**Files:**
- Modify: `server/index.js` (quota endpoint)

**Step 1: Hybrid Quota**
- `getPoolQuota` should prefer log-derived counts if available.
- Maybe show "Live" badge in UI.

---

**Execution:**
1. I will read your logs first to determine the regex.
2. Then I will implement the watcher.
