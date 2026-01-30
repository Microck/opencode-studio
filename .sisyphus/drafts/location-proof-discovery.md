# Draft: Location-Proof Discovery Implementation

## Context
User wants to make skills, commands, MCPs, and plugins location-proof in opencode-studio. Currently only discovers from singular directories (skill/, plugin/) and opencode.json, but should also discover from plural directories (skills/, plugins/, command/, mcp/).

## Required Changes Identified
1. Expand `getSkillDirs()` to search `skills/` directories (plural)
2. Create `getCommandDirs()` to discover commands from `command/` directories
3. Create `getMcpDirs()` to discover MCPs from `mcp/` directories
4. Expand `getPluginDirs()` to search `plugins/` directories (plural)
5. Update API endpoints to aggregate from directories AND config files
6. Add source tracking (e.g., source: 'skill-dir', 'skills-dir', 'json-config')

## User's System Layout
```
~/.config/opencode/
├── skill/              # 18 skills - DISCOVERED ✓
├── skills/             # External packages - NOT DISCOVERED ✗
├── command/            # Slash commands - NOT DISCOVERED ✗
├── mcp/                # MCP configs - NOT DISCOVERED ✗
├── plugin/             # Plugins - DISCOVERED ✓
├── plugins/            # More plugins - NOT DISCOVERED ✗
```

## Open Questions (Need User Input)
1. Command format details - Is command/{name}.md correct? YAML frontmatter?
2. MCP format details - JSON files? YAML files? What structure?
3. Source tracking field name - 'source' or 'location' or 'discovered_from'?
4. Priority handling - What order for directory discovery? skills/ before skill/?
5. Duplicate handling - Same skill in skill/ and skills/ - merge or prefer one?
6. Should we handle nested structures like skills/{package}/skills/{name}/SKILL.md?
