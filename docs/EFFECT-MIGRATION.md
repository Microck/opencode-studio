# TypeScript + Effect migration plan

Start after the corrected JavaScript baseline has been tested and released. The
Next.js frontend is already TypeScript; the backend and runtime boundaries are the
primary migration target. Do not treat a renamed JavaScript file or a wrapper
around the existing monolith as a completed rewrite.

## Compatibility baseline

Preserve existing API routes, configuration formats, unknown JSONC fields,
profile data, plugin/skill formats, CLI/deep-link behavior, local-only binding and
explicit trusted origins. Keep login and spending separate from offline tests.
Existing user data must not require a destructive migration.

## Implementation slices

1. Strict TypeScript shared request/response schemas and tagged errors. Validate
   inbound payloads and preserve useful structured error responses.
2. Effect services/layers for filesystem access, profile transactions, configuration
   discovery, atomic writes, backups and process execution. Inject synthetic paths
   in tests rather than inspecting the developer's real home.
3. Typed HTTP routing and lifecycle management. Scope server sockets, file watchers,
   streams, polling and child processes; cancellation must clean them up.
4. Authentication and synchronization services with redacted errors and no automatic
   credential creation. Keep secret data outside logs and test fixtures.
5. Typed frontend API boundaries and cancellable state flows. Retain the existing
   visual design; cover profile switches, interrupted dialogs and stale responses.
6. Remove the old backend implementation only after contract/regression parity,
   cross-platform CI, packaging and a clean install prove the replacement.

## Version selection

At research time, npm reports Effect 4.0.6 and @effect/platform-node 4.0.6.
Effect v4 and v3 APIs differ; use the v4 official documentation and matching
packages, not legacy snippets or the old @effect/platform package by accident.
Recheck the chosen exact versions before implementation.

Primary references:
- https://effect.website/docs/v4/getting-started
- https://effect.website/docs/v4/schema/introduction
- https://effect.website/docs/v4/runtime
- https://github.com/Effect-TS/effect/blob/main/LLMS.md
