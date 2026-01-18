---
created: 2026-01-18T19:56
title: Fix OpenAI Codex multi-account detection
area: auth
files:
  - server/proxy-manager.js
  - server/index.js
---

## Problem

OpenAI Codex pool only detects one account even when multiple exist. Adding new accounts via login doesn't update the pool.

Possible cause: accounts share the same OpenAI Business group, so CLIProxyAPI may be storing them with the same identifier or overwriting.

## Solution

TBD - investigate how CLIProxyAPI stores Codex accounts in ~/.cli-proxy-api/ and whether business group affects file naming/deduplication.
