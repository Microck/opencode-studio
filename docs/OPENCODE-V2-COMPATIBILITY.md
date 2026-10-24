# OpenCode v2 compatibility investigation

Work in progress, not a compatibility claim.

Verified reference: official npm `@opencode/cli`, `@opencode/client`, and
`@opencode/schema` 2.1.4. An isolated CLI reports `opencode v2.1.4`.
No provider credentials, model requests or user configuration were used.

Primary sources:
- https://opencode.ai/v2/docs/migrate-v1/
- https://opencode.ai/v2/docs/config/
- https://opencode.ai/v2/docs/agents/
- https://opencode.ai/v2/docs/commands/
- https://opencode.ai/v2/docs/mcp-servers/
- https://opencode.ai/v2/docs/plugins/

## Compatibility boundaries

V2 retains supported V1 configuration locations and normalizes supported legacy
fields in memory. Native V2 fields win conflicts. Individual nested agents,
providers, commands and models must not be reconstructed as mixed-format entries.
A configuration manager must preserve unknown fields and source format, not
silently migrate a user's entire setup.

Explicit migration surfaces include the plugin API, server/client contracts,
and terminal settings moving to a global `cli.json`. V1 plugins cannot be assumed
to run under V2. Existing plugins must remain untouched until a deliberate port.

Native fields to cover include `agents`, `commands`, `providers`, `plugins`,
`permissions`, and `mcp.servers`. Agents use `system`, `disabled`, `steps` and
ordered permission rules; MCP uses `disabled` rather than `enabled`. Ordered
permissions cannot safely be flattened into the current legacy object editor.

## Runtime observations

With synthetic HOME and XDG paths, `opencode debug paths` reports data under
`$XDG_DATA_HOME/opencode`, including `opencode.db`; config remains under
`$XDG_CONFIG_HOME/opencode`. The v2 client exposes `/api/credential` contracts.
This does not establish compatibility with Studio's legacy auth-file operations
or usage-database queries; those require explicit fixtures and native checks.

## Next verification

- Version/capability detection without inference or global installation changes.
- V1/V2 read/edit/write round trips preserving source shape and unknown fields.
- Native agents, commands, MCP, providers and ordered permission editing.
- Global CLI settings and plugin compatibility warnings.
- Credential metadata and usage schema compatibility without exposing secrets.
- Real v2.1.4 config/agent discovery against synthetic fixtures.

## Implemented regression coverage (not yet complete)

- Native JSON agents: read, POST/PUT edit, disable/enable and delete, without
  introducing legacy `agent` entries. Preserve ordered permissions and unknown
  fields; keep explicit object model selections intact when unchanged.
- Native commands: read, edit and delete, preserving metadata and removing a
  same-name legacy shadow on explicit deletion.
- MCP: native container read/edit/delete and disabled semantics; preserve global
  timeout policies and unknown server fields. Do not mistake legitimate legacy
  servers called `servers` or `timeout` for containers. Preset toggles target
  actual servers rather than container metadata.
- Native agent editors do not offer legacy tool switches or temperature controls.

Runtime limitations remain for native credential mutations and plugin-ID controls;
see the latest checks below. Full native CLI agent discovery is still unresolved.
No blanket v2 compatibility claim.

Native Markdown agent fields now round-trip in place (including unknown fields,
ordered permissions, steps and disabled); HTTP fixtures cover this. Provider model
maps and plugin `{package, options}` entries now appear in inventories. Usage
supports native `session_message`/`session_v2` and legacy table families, including
coexisting histories, with explicit failures for unreadable/unknown schemas.

The isolated official CLI's config inspection finds the synthetic global config,
but both `debug agents` and standalone `GET /api/agent` returned empty inventories,
including with a project Markdown fixture. This remains unresolved; do not claim
native CLI agent-discovery verification passed.


## Latest checks and explicit limits

- 55 backend tests and 29 frontend tests (9 native Node, 20 Vitest) pass.
- TypeScript, production build and lint pass (44 existing/non-blocking warnings).
- Actual 500px browser run: native agent editing preserves explicit model objects
  and permission order. The cross-page MCP overwrite was reproduced, fixed, and
  repeated successfully with both permission rules and MCP timeout/codemode intact.
- Global CLI JSON editor rejects stale revisions and invalid/non-object JSON;
  unit tests verify v1 `tui.json` and server config are untouched.
- Native credential storage is read-only metadata. SQL never selects credential
  values. Legacy auth mutation routes are blocked when native config/storage is
  detected, instead of claiming they change v2 credentials.
- Native plugin entries/options can be listed, added and removed. Runtime toggles
  deliberately do not guess plugin IDs from npm package names; use Raw Config.
- Native default agent mode is primary, not the legacy UI's subagent default.

No model inference, external login or real credential change was performed.
Publication follows the release runbook. The owner authorized the specific
contribution-policy exception on 2026-10-24; all listed checks were automated,
and no human testing or unavailable exact model identity is claimed.

Official `@opencode/schema` 2.1.4 successfully decoded the edited native fixture
covering agents, commands, provider model maps, MCP and plugin options. This
validates source shape but does not resolve the empty runtime agent inventory.
