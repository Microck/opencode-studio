# Oh My OpenCode Models + GitHub Backup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** add oh-my-opencode model fallback config UI + GitHub private repo backup, remove gdrive/onedrive sync, and logout via opencode auth logout.

**Architecture:** server exposes new ohmy + github backup endpoints; studio.json stores preferences; oh-my-opencode.json is written with active model. frontend settings page manages preferences + backup triggers.

**Tech Stack:** Next.js 16, Express, axios, gh CLI

---

### Task 1: add oh-my-opencode preferences types

**Files:**
- Modify: `client-next/src/types/index.ts`

**Step 1: Write failing test**
Skip (no test framework). Approved by user.

**Step 2: Write minimal implementation**
Add types:
```ts
export interface OhMyModelChoice { model: string; available: boolean; }
export interface OhMyAgentPreferences { choices: OhMyModelChoice[]; }
export interface OhMyPreferences { agents: Record<string, OhMyAgentPreferences>; }
export interface OhMyConfigResponse { path: string | null; exists: boolean; config: any | null; preferences: OhMyPreferences; warnings?: string[]; }
```

**Step 3: Verify**
Skip tests. Later run lsp diagnostics.

---

### Task 2: add API client methods

**Files:**
- Modify: `client-next/src/lib/api.ts`

**Step 1: Write failing test**
Skip (no test framework).

**Step 2: Write minimal implementation**
Add:
```ts
export async function getOhMyConfig(): Promise<OhMyConfigResponse> {
  const { data } = await api.get('/ohmyopencode');
  return data;
}

export async function saveOhMyConfig(preferences: OhMyPreferences): Promise<OhMyConfigResponse> {
  const { data } = await api.post('/ohmyopencode', { preferences });
  return data;
}

export async function backupToGithub(payload: { owner?: string; repo: string; branch?: string }): Promise<{ success: boolean; url?: string; message?: string }> {
  const { data } = await api.post('/github/backup', payload);
  return data;
}
```

Remove gdrive API methods.

---

### Task 3: server oh-my endpoints

**Files:**
- Modify: `server/index.js`

**Step 1: Write failing test**
Skip (no test framework).

**Step 2: Write minimal implementation**
Add helpers:
```js
const getConfigDir = () => {
  const cp = getConfigPath();
  return cp ? path.dirname(cp) : null;
};

const getOhMyPath = () => {
  const dir = getConfigDir();
  return dir ? path.join(dir, 'oh-my-opencode.json') : null;
};

const loadOhMyConfig = () => {
  const p = getOhMyPath();
  if (!p || !fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

const writeOhMyConfig = (cfg) => {
  const p = getOhMyPath();
  if (!p) throw new Error('No config path found');
  atomicWriteFileSync(p, JSON.stringify(cfg, null, 2));
};

const selectActiveModel = (choices) => (choices || []).find(c => c.available)?.model || null;
```
Endpoints:
- `GET /api/ohmyopencode` returns path/exists/config/preferences (from studio.ohmy)
- `POST /api/ohmyopencode` saves `preferences` into studio.json and writes oh‑my‑opencode.json with chosen models; if none available, keep previous model and add warning.

---

### Task 4: server github backup

**Files:**
- Modify: `server/index.js`

**Step 1: Write failing test**
Skip.

**Step 2: Write minimal implementation**
Add `/api/github/backup`:
- Run `gh auth token` to get token.
- Use GitHub REST: check repo exists; if not, create private repo under user (or org if owner passed).
- Build file list of `~/.config/opencode/**` and `~/.config/opencode-studio/**` (recursive). Store paths as `opencode/...` and `opencode-studio/...`.
- Create a single commit via Git Data API (create blobs, tree, commit, update ref). Default branch `main`.
- Save last used repo/branch in studio.json.

---

### Task 5: update auth logout

**Files:**
- Modify: `server/index.js`

**Step 1: Write failing test**
Skip.

**Step 2: Write minimal implementation**
Replace delete auth handler to open terminal and run `opencode auth logout` (same platform logic as login). Return success with note. Keep existing config cleanup after logout? If CLI handles, still clear local auth config afterward.

---

### Task 6: frontend settings changes

**Files:**
- Modify: `client-next/src/app/settings/page.tsx`

**Step 1: Write failing test**
Skip.

**Step 2: Write minimal implementation**
- Add new Oh My OpenCode section with per-agent 3 model inputs + availability toggles. Save calls `saveOhMyConfig` and shows warnings.
- Add GitHub backup panel with owner/repo/branch input and button calling `backupToGithub`.
- Remove Google Drive sync button/callback; only Dropbox remains.

---

### Task 7: remove gdrive/onedrive sync

**Files:**
- Modify: `server/index.js` (remove gdrive endpoints + client id const)
- Modify: `client-next/src/lib/api.ts` (remove gdrive methods)
- Modify: `client-next/src/app/settings/page.tsx` (remove gdrive UI + callback fallback)
- Modify: `README.md` docs (remove google/onedrive mentions)

---

### Task 8: changeset + docs

**Files:**
- Modify: `.changeset/0000-task.md` (brief summary)

---

### Task 9: verification

Run `lsp_diagnostics` on touched files. Tests skipped (no npm test).

---

**Unresolved questions:** none.
