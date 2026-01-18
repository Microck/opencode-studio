---
created: 2026-01-18T20:05
title: Fix account removal and Antigravity request tracking
area: auth
files:
  - server/index.js
  - client-next/src/app/auth/page.tsx
---

## Problem

Two related issues in the auth/pool system:

1. **OpenAI account removal broken**: Removing or clearing OpenAI accounts from the pool doesn't work correctly - accounts persist or UI doesn't update.

2. **Antigravity request counts not updating**: The usage/request counter for Antigravity accounts doesn't increment properly when requests are made.

## Solution

TBD - investigate:
- `deleteAuthProfile` and `clearAllAuthProfiles` functions for OpenAI provider
- Log watcher for Antigravity usage tracking
- Pool metadata update logic
