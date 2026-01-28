# Plan: Multi-Provider Auth Pool Support

**Status**: Draft
**Date**: 2026-01-27
**Goal**: Extend OpenCode Studio's Account Pool and Rotation system to support OpenAI/Codex, specifically compatible with the `opencode-openai-codex-auth-multi` plugin.

## Context
Currently, the "Account Pool" and "Auto-Rotation" features in Studio are heavily optimized for `google.antigravity` (Gemini/Claude via Google).
- Backend reads `antigravity-accounts.json`.
- Backend watches logs for `google.antigravity` 429 errors.
- Frontend shows pool card for "Google".

We need to support OpenAI rotation because users are adopting the `opencode-openai-codex-auth-multi` plugin.

## Analysis
1. **Backend (`server/index.js`)**
   - `syncAntigravityPool()` is hardcoded for Google.
   - `rotateAccount()` is generic but relies on profiles being present in `auth-profiles/{provider}`.
   - `processLogLine()` handles `openai` provider ID but might need verifying it catches the specific log format of the multi-auth plugin.
   - `importCurrentAuthToPool()` handles single OpenAI keys but not lists.

2. **Frontend (`client-next/`)**
   - `AccountPoolCard` is a generic component, but only instantiated for Google in `src/app/auth/page.tsx` (assumed).
   - Needs to dynamically show pool cards for any provider that has multiple profiles.

## Implementation Steps

### 1. Backend: Generic Pool Synchronization
- [ ] Rename `syncAntigravityPool` to `syncExternalAccounts`.
- [ ] Add logic to read OpenAI accounts from `opencode-openai-codex-auth-multi` config.
  - *Assumption*: It uses `accounts` array in `opencode.json` or a separate file.
  - *Action*: Need to verify where this plugin stores its keys. (Will assume `opencode.json` `codex.accounts` or similar for now, but will verify during implementation).
- [ ] Ensure `auth-profiles/openai/` is populated with these accounts.

### 2. Backend: Log Watcher Updates
- [ ] Verify `processLogLine` correctly identifies OpenAI 429s.
- [ ] Ensure `rotateAccount` updates the *correct* config file that `opencode-openai-codex-auth-multi` reads.
  - *Critical*: Does the plugin read from `auth.json`? Or `opencode.json`?
  - If the plugin reads a specific file, `rotateAccount` must update *that* file's "active" index or current token.

### 3. Frontend: Multi-Pool UI
- [ ] Update `src/app/auth/page.tsx` to render `AccountPoolCard` for OpenAI if profiles exist.
- [ ] Allow manual "Add Account" for OpenAI (which should prompt for API Key/AccessToken).

### 4. Protocol & CLI
- [ ] Ensure `opencode auth login` works for adding *new* accounts to the pool (not just replacing the single active one).

## Open Questions
- Where exactly does `opencode-openai-codex-auth-multi` store its list of keys?
- Does it listen to a specific file for the "active" key, or does it manage rotation internally per-request?
  - *Hypothesis*: If it manages internally, Studio just needs to *display* the status. If Studio needs to *drive* the rotation (like it does for Antigravity), we need to know what file to write to.

## Next Steps
- Install/analyze `opencode-openai-codex-auth-multi` to answer config questions.
- Refactor `server/index.js` to decouple pool logic from Google.
