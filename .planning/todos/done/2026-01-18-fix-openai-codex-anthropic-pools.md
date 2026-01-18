---
created: 2026-01-18T19:32
title: Fix OpenAI Codex and Anthropic Pools
area: ui
files:
  - client-next/
  - server/index.js
---

## Problem

Only Antigravity (Gemini) pool works. OpenAI Codex and Anthropic Pools are broken/non-functional.

Additional issues:
- Dashboard button may be non-functional (remove if it does nothing)
- Pool names are incorrect - e.g., "3 Pro (Antigravity)" should be "Gemini 3 Pro (Antigravity)"

## Solution

1. Debug why Codex and Anthropic pools fail while Antigravity works
2. Fix pool configuration/connection logic
3. Test Dashboard button - remove if non-functional
4. Update pool display names to include provider prefix (Gemini, OpenAI, Anthropic)
