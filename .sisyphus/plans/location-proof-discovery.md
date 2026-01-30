# Work Plan: Location-Proof Discovery for Skills, Commands, MCPs, Plugins

## Context

### User Request
Make skills, commands, MCPs, and plugins location-proof in opencode-studio. Current implementation only discovers from fixed paths and opencode.json, but should support multiple directory sources.

### Current State (server/index.js)
- `getSkillDirs()`: Searches `{root}/skill/` only (singular)
- `getPluginDirs()`: Searches `{root}/plugin/` only (singular)  
- Commands: Only from opencode.json `slashCommands` field
- MCPs: Only from opencode.json `mcpServers` field
- Agents: Already searches multiple variations `{root}/agents/`

### Required Discovery Paths
| Entity | Singular | Plural | Nested |
|--------|----------|--------|--------|
| Skills | `{root}/skill/` | `{root}/skills/` | `skills/{pkg}/skills/{name}/` |
| Commands | `{root}/command/` | N/A | N/A |
| MCPs | `{root}/mcp/` | N/A | N/A |
| Plugins | `{root}/plugin/` | `{root}/plugins/` | N/A |

### Source Tracking Requirement
Add `source` field to all discovered items:
- `source: 'skill-dir'` - from `{root}/skill/`
- `source: 'skills-dir'` - from `{root}/skills/`
- `source: 'command-dir'` - from `{root}/command/`
- `source: 'mcp-dir'` - from `{root}/mcp/`
- `source: 'plugin-dir'` - from `{root}/plugin/`
- `source: 'plugins-dir'` - from `{root}/plugins/`
- `source: 'json-config'` - from opencode.json

## Task Dependency Graph

| Task | Depends On | Blocks | Reason |
|------|------------|--------|--------|
| Task 1: Expand getSkillDirs() | None | Task 5 | Foundation - adds skills/ discovery |
| Task 2: Create getCommandDirs() | None | Task 6 | Foundation - new command discovery |
| Task 3: Create getMcpDirs() | None | Task 7 | Foundation - new MCP discovery |
| Task 4: Expand getPluginDirs() | None | Task 8 | Foundation - adds plugins/ discovery |
| Task 5: Update Skills API | Task 1 | None | Uses expanded skill discovery |
| Task 6: Update Commands API | Task 2 | None | Uses new command discovery |
| Task 7: Update MCPs API | Task 3 | None | Uses new MCP discovery |
| Task 8: Update Plugins API | Task 4 | None | Uses expanded plugin discovery |

## Parallel Execution Graph

```
Wave 1 (Start immediately - foundation):
├── Task 1: Expand getSkillDirs() (no deps)
├── Task 2: Create getCommandDirs() (no deps)
├── Task 3: Create getMcpDirs() (no deps)
└── Task 4: Expand getPluginDirs() (no deps)

Wave 2 (After Wave 1 completes - API updates):
├── Task 5: Update Skills API (depends: Task 1)
├── Task 6: Update Commands API (depends: Task 2)
├── Task 7: Update MCPs API (depends: Task 3)
└── Task 8: Update Plugins API (depends: Task 4)

Wave 3 (After Wave 2 - verification):
└── Task 9: Integration testing and verification

Critical Path: Task 1 → Task 5 (Skills)
                Task 2 → Task 6 (Commands)
                Task 3 → Task 7 (MCPs)
                Task 4 → Task 8 (Plugins)
Parallel Speedup: ~60% faster than sequential (4 parallel foundations)
```

## Tasks

### Task 1: Expand getSkillDirs() for skills/ Directories

**Description**:
Extend `getSkillDirs()` in `server/index.js` to also search `skills/` directories alongside existing `skill/` directories. Handle nested package structures like `skills/{package}/skills/{name}/SKILL.md`.

**File**: `server/index.js`

**Code Changes**:
1. Modify `getSkillDirs()` function (around line ~45-60 based on pattern):
   - Add `skills/` to search list
   - Handle nested `skills/{pkg}/skills/{name}/` structure
   - Return array of all valid skill directories with source tracking

2. Add `SKILL_DIRECTORIES` constant:
```javascript
const SKILL_DIRECTORIES = [
  { dir: 'skill', source: 'skill-dir', nested: false },
  { dir: 'skills', source: 'skills-dir', nested: true } // handles pkg/skill/name
];
```

3. Update function to return metadata:
```javascript
function getSkillDirs(searchRoots) {
  const dirs = [];
  for (const root of searchRoots) {
    // Singular skill/ directory
    const skillDir = path.join(root, 'skill');
    if (fs.existsSync(skillDir)) {
      dirs.push({ path: skillDir, source: 'skill-dir', root });
    }
    
    // Plural skills/ directory with nested structure
    const skillsDir = path.join(root, 'skills');
    if (fs.existsSync(skillsDir)) {
      const packages = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      for (const pkg of packages) {
        const nestedSkillsDir = path.join(skillsDir, pkg.name, 'skills');
        if (fs.existsSync(nestedSkillsDir)) {
          dirs.push({ path: nestedSkillsDir, source: 'skills-dir', root, package: pkg.name });
        }
      }
    }
  }
  return dirs;
}
```

**Delegation Recommendation**:
- Category: `unspecified-low` - Moderate effort, backend Node.js work
- Skills: [`typescript-programmer`, `git-master`]
  - `typescript-programmer`: Needed for understanding TypeScript patterns in server code
  - `git-master`: For atomic commits

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: server/index.js uses JavaScript with JSDoc types
- INCLUDED `git-master`: Standard for all code changes
- OMITTED `frontend-ui-ux`: No UI changes in this task
- OMITTED `dev-browser`: No browser automation needed

**Depends On**: None
**Parallel Group**: Wave 1

**Acceptance Criteria**:
- [ ] `getSkillDirs()` returns directories from both `skill/` and `skills/` locations
- [ ] Nested structure `skills/{pkg}/skills/` is properly discovered
- [ ] Each directory includes `source` field ('skill-dir' or 'skills-dir')
- [ ] Verify: Create `~/.config/opencode/skills/test-pkg/skills/test-skill/SKILL.md`
- [ ] Verify: API call returns skill with `source: 'skills-dir'`
- [ ] Verify: Existing `skill/` skills still work with `source: 'skill-dir'`

---

### Task 2: Create getCommandDirs() for Command Discovery

**Description**:
Create new `getCommandDirs()` function to discover slash commands from `command/` directories. Commands are stored as `.md` files with optional YAML frontmatter.

**File**: `server/index.js`

**Code Changes**:
1. Add `COMMAND_DIRECTORIES` constant:
```javascript
const COMMAND_DIRECTORIES = [
  { dir: 'command', source: 'command-dir' }
];
```

2. Create `getCommandDirs()` function:
```javascript
function getCommandDirs(searchRoots) {
  const dirs = [];
  for (const root of searchRoots) {
    const cmdDir = path.join(root, 'command');
    if (fs.existsSync(cmdDir)) {
      dirs.push({ path: cmdDir, source: 'command-dir', root });
    }
  }
  return dirs;
}
```

3. Create `loadCommandsFromDir()` function:
```javascript
function loadCommandsFromDir(dirInfo) {
  const commands = [];
  if (!fs.existsSync(dirInfo.path)) return commands;
  
  const files = fs.readdirSync(dirInfo.path)
    .filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const filePath = path.join(dirInfo.path, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const name = path.basename(file, '.md');
    
    // Parse YAML frontmatter if present
    let metadata = {};
    let body = content;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (frontmatterMatch) {
      try {
        metadata = yaml.load(frontmatterMatch[1]) || {};
        body = frontmatterMatch[2].trim();
      } catch (e) {
        // Invalid YAML, treat as plain content
      }
    }
    
    commands.push({
      name,
      content: body,
      description: metadata.description || '',
      source: dirInfo.source,
      path: filePath,
      ...metadata
    });
  }
  return commands;
}
```

**Note**: Requires `js-yaml` package (verify already in dependencies or add).

**Delegation Recommendation**:
- Category: `unspecified-low` - Similar to Task 1
- Skills: [`typescript-programmer`, `git-master`]
  - `typescript-programmer`: For file parsing logic
  - `git-master`: For commits

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: File parsing, YAML handling
- INCLUDED `git-master`: Standard
- OMITTED `frontend-ui-ux`: Backend only
- OMITTED `agent-browser`: No browser automation

**Depends On**: None
**Parallel Group**: Wave 1

**Acceptance Criteria**:
- [ ] `getCommandDirs()` returns array of command directories with source metadata
- [ ] `loadCommandsFromDir()` parses .md files and extracts frontmatter
- [ ] Each command has `source: 'command-dir'`
- [ ] Verify: Create `~/.config/opencode/command/test.md` with content
- [ ] Verify: Function returns command with correct name and content
- [ ] Verify: YAML frontmatter is parsed into metadata fields

---

### Task 3: Create getMcpDirs() for MCP Discovery

**Description**:
Create new `getMcpDirs()` function to discover MCP server configurations from `mcp/` directories. MCPs are stored as JSON or YAML files with server configuration.

**File**: `server/index.js`

**Code Changes**:
1. Add `MCP_DIRECTORIES` constant:
```javascript
const MCP_DIRECTORIES = [
  { dir: 'mcp', source: 'mcp-dir' }
];
```

2. Create `getMcpDirs()` function:
```javascript
function getMcpDirs(searchRoots) {
  const dirs = [];
  for (const root of searchRoots) {
    const mcpDir = path.join(root, 'mcp');
    if (fs.existsSync(mcpDir)) {
      dirs.push({ path: mcpDir, source: 'mcp-dir', root });
    }
  }
  return dirs;
}
```

3. Create `loadMcpsFromDir()` function:
```javascript
function loadMcpsFromDir(dirInfo) {
  const mcps = [];
  if (!fs.existsSync(dirInfo.path)) return mcps;
  
  const files = fs.readdirSync(dirInfo.path)
    .filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
  
  for (const file of files) {
    const filePath = path.join(dirInfo.path, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const name = path.basename(file, path.extname(file));
    
    let config;
    try {
      if (file.endsWith('.json')) {
        config = JSON.parse(content);
      } else {
        config = yaml.load(content);
      }
      
      mcps.push({
        name,
        config,
        source: dirInfo.source,
        path: filePath
      });
    } catch (e) {
      console.error(`Failed to parse MCP config ${filePath}:`, e.message);
    }
  }
  return mcps;
}
```

**Delegation Recommendation**:
- Category: `unspecified-low` - Similar pattern to Task 2
- Skills: [`typescript-programmer`, `git-master`]

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: JSON/YAML parsing
- INCLUDED `git-master`: Standard
- OMITTED Others: Backend only

**Depends On**: None
**Parallel Group**: Wave 1

**Acceptance Criteria**:
- [ ] `getMcpDirs()` returns array of MCP directories with source metadata
- [ ] `loadMcpsFromDir()` parses .json and .yaml files
- [ ] Each MCP has `source: 'mcp-dir'`
- [ ] Verify: Create `~/.config/opencode/mcp/test-server.json`
- [ ] Verify: Function returns MCP with correct name and parsed config
- [ ] Verify: Invalid JSON/YAML is handled gracefully with error log

---

### Task 4: Expand getPluginDirs() for plugins/ Directories

**Description**:
Extend `getPluginDirs()` to also search `plugins/` directories alongside existing `plugin/` directories. Simpler than skills - no nested structure.

**File**: `server/index.js`

**Code Changes**:
1. Add `PLUGIN_DIRECTORIES` constant:
```javascript
const PLUGIN_DIRECTORIES = [
  { dir: 'plugin', source: 'plugin-dir' },
  { dir: 'plugins', source: 'plugins-dir' }
];
```

2. Update `getPluginDirs()` function:
```javascript
function getPluginDirs(searchRoots) {
  const dirs = [];
  for (const root of searchRoots) {
    // Singular plugin/
    const pluginDir = path.join(root, 'plugin');
    if (fs.existsSync(pluginDir)) {
      dirs.push({ path: pluginDir, source: 'plugin-dir', root });
    }
    
    // Plural plugins/
    const pluginsDir = path.join(root, 'plugins');
    if (fs.existsSync(pluginsDir)) {
      dirs.push({ path: pluginsDir, source: 'plugins-dir', root });
    }
  }
  return dirs;
}
```

**Delegation Recommendation**:
- Category: `quick` - Very similar to existing pattern, minimal changes
- Skills: [`typescript-programmer`, `git-master`]

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: Simple extension of existing function
- INCLUDED `git-master`: Standard
- OMITTED Others: Backend only

**Depends On**: None
**Parallel Group**: Wave 1

**Acceptance Criteria**:
- [ ] `getPluginDirs()` returns directories from both `plugin/` and `plugins/`
- [ ] Each directory includes `source` field ('plugin-dir' or 'plugins-dir')
- [ ] Verify: Create `~/.config/opencode/plugins/test-plugin/`
- [ ] Verify: API returns plugin with `source: 'plugins-dir'`
- [ ] Verify: Existing `plugin/` plugins work with `source: 'plugin-dir'`

---

### Task 5: Update Skills API Endpoint with Source Tracking

**Description**:
Update the skills API endpoint to aggregate skills from all discovered directories and merge with opencode.json skills. Add source tracking to distinguish origin.

**File**: `server/index.js`

**API Endpoint**: `GET /api/skills` (or equivalent)

**Code Changes**:
1. Update skills aggregation logic:
```javascript
// In loadAggregatedConfig or skills endpoint handler
function aggregateSkills(searchRoots) {
  const skillDirs = getSkillDirs(searchRoots);
  const allSkills = [];
  
  // Load from directories
  for (const dirInfo of skillDirs) {
    const skills = loadSkillsFromDir(dirInfo);
    for (const skill of skills) {
      allSkills.push({
        ...skill,
        source: dirInfo.source,
        location: dirInfo.path
      });
    }
  }
  
  // Load from opencode.json (existing logic)
  for (const config of loadAllConfigs(searchRoots)) {
    if (config.skills) {
      for (const skill of config.skills) {
        allSkills.push({
          ...skill,
          source: 'json-config',
          configPath: config.path
        });
      }
    }
  }
  
  return allSkills;
}
```

2. Handle duplicates (same skill name from multiple sources):
```javascript
function deduplicateSkills(skills) {
  const seen = new Map();
  for (const skill of skills) {
    const existing = seen.get(skill.name);
    if (!existing) {
      seen.set(skill.name, skill);
    } else {
      // Prefer skills-dir over skill-dir, prefer dir over json-config
      const priority = { 'skills-dir': 3, 'skill-dir': 2, 'json-config': 1 };
      if (priority[skill.source] > priority[existing.source]) {
        seen.set(skill.name, skill);
      }
    }
  }
  return Array.from(seen.values());
}
```

**Delegation Recommendation**:
- Category: `unspecified-low` - API integration work
- Skills: [`typescript-programmer`, `git-master`]

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: API logic, data aggregation
- INCLUDED `git-master`: Standard

**Depends On**: Task 1
**Parallel Group**: Wave 2

**Acceptance Criteria**:
- [ ] Skills endpoint returns skills from both `skill/` and `skills/` directories
- [ ] Each skill has `source` field indicating origin
- [ ] Duplicates are handled with priority: skills-dir > skill-dir > json-config
- [ ] Verify: Skill from `skills/` shows `source: 'skills-dir'`
- [ ] Verify: Skill from `skill/` shows `source: 'skill-dir'`
- [ ] Verify: Duplicate skill prefers directory version over JSON config

---

### Task 6: Update Commands API Endpoint

**Description**:
Update the commands API endpoint to aggregate commands from discovered directories and merge with opencode.json slashCommands. Add source tracking.

**File**: `server/index.js`

**API Endpoint**: `GET /api/commands` (or equivalent)

**Code Changes**:
1. Update commands aggregation logic:
```javascript
function aggregateCommands(searchRoots) {
  const cmdDirs = getCommandDirs(searchRoots);
  const allCommands = [];
  
  // Load from directories
  for (const dirInfo of cmdDirs) {
    const commands = loadCommandsFromDir(dirInfo);
    allCommands.push(...commands);
  }
  
  // Load from opencode.json (existing logic)
  for (const config of loadAllConfigs(searchRoots)) {
    if (config.slashCommands) {
      for (const [name, content] of Object.entries(config.slashCommands)) {
        allCommands.push({
          name,
          content,
          source: 'json-config',
          configPath: config.path
        });
      }
    }
  }
  
  return deduplicateCommands(allCommands);
}

function deduplicateCommands(commands) {
  const seen = new Map();
  for (const cmd of commands) {
    const existing = seen.get(cmd.name);
    if (!existing || cmd.source === 'command-dir') {
      // Prefer directory over JSON
      seen.set(cmd.name, cmd);
    }
  }
  return Array.from(seen.values());
}
```

**Delegation Recommendation**:
- Category: `unspecified-low` - Similar to Task 5
- Skills: [`typescript-programmer`, `git-master`]

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: API logic
- INCLUDED `git-master`: Standard

**Depends On**: Task 2
**Parallel Group**: Wave 2

**Acceptance Criteria**:
- [ ] Commands endpoint returns commands from `command/` directories
- [ ] Each command has `source: 'command-dir'` or `source: 'json-config'`
- [ ] Directory commands take precedence over JSON config commands
- [ ] Verify: Command from `command/test.md` shows in API with correct content
- [ ] Verify: Command from opencode.json also appears
- [ ] Verify: Duplicate command name prefers directory version

---

### Task 7: Update MCPs API Endpoint

**Description**:
Update the MCPs API endpoint to aggregate MCP servers from discovered directories and merge with opencode.json mcpServers. Add source tracking.

**File**: `server/index.js`

**API Endpoint**: `GET /api/mcps` (or equivalent)

**Code Changes**:
1. Update MCP aggregation logic:
```javascript
function aggregateMcps(searchRoots) {
  const mcpDirs = getMcpDirs(searchRoots);
  const allMcps = [];
  
  // Load from directories
  for (const dirInfo of mcpDirs) {
    const mcps = loadMcpsFromDir(dirInfo);
    allMcps.push(...mcps);
  }
  
  // Load from opencode.json (existing logic)
  for (const config of loadAllConfigs(searchRoots)) {
    if (config.mcpServers) {
      for (const [name, mcpConfig] of Object.entries(config.mcpServers)) {
        allMcps.push({
          name,
          config: mcpConfig,
          source: 'json-config',
          configPath: config.path
        });
      }
    }
  }
  
  return deduplicateMcps(allMcps);
}

function deduplicateMcps(mcps) {
  const seen = new Map();
  for (const mcp of mcps) {
    const existing = seen.get(mcp.name);
    if (!existing || mcp.source === 'mcp-dir') {
      // Prefer directory over JSON
      seen.set(mcp.name, mcp);
    }
  }
  return Array.from(seen.values());
}
```

**Delegation Recommendation**:
- Category: `unspecified-low` - Similar to Tasks 5-6
- Skills: [`typescript-programmer`, `git-master`]

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: API logic
- INCLUDED `git-master`: Standard

**Depends On**: Task 3
**Parallel Group**: Wave 2

**Acceptance Criteria**:
- [ ] MCPs endpoint returns MCPs from `mcp/` directories
- [ ] Each MCP has `source: 'mcp-dir'` or `source: 'json-config'`
- [ ] Directory MCPs take precedence over JSON config MCPs
- [ ] Verify: MCP from `mcp/test.json` shows in API with parsed config
- [ ] Verify: MCP from opencode.json mcpServers also appears
- [ ] Verify: Duplicate MCP name prefers directory version

---

### Task 8: Update Plugins API Endpoint

**Description**:
Update the plugins API endpoint to aggregate plugins from all discovered directories and merge with opencode.json plugins. Add source tracking.

**File**: `server/index.js`

**API Endpoint**: `GET /api/plugins` (or equivalent)

**Code Changes**:
1. Update plugins aggregation logic:
```javascript
function aggregatePlugins(searchRoots) {
  const pluginDirs = getPluginDirs(searchRoots);
  const allPlugins = [];
  
  // Load from directories
  for (const dirInfo of pluginDirs) {
    const plugins = loadPluginsFromDir(dirInfo);
    for (const plugin of plugins) {
      allPlugins.push({
        ...plugin,
        source: dirInfo.source,
        location: dirInfo.path
      });
    }
  }
  
  // Load from opencode.json (existing logic)
  for (const config of loadAllConfigs(searchRoots)) {
    if (config.plugins) {
      for (const plugin of config.plugins) {
        allPlugins.push({
          ...plugin,
          source: 'json-config',
          configPath: config.path
        });
      }
    }
  }
  
  return deduplicatePlugins(allPlugins);
}

function deduplicatePlugins(plugins) {
  const seen = new Map();
  for (const plugin of plugins) {
    const existing = seen.get(plugin.name);
    if (!existing) {
      seen.set(plugin.name, plugin);
    } else {
      // Priority: plugins-dir > plugin-dir > json-config
      const priority = { 'plugins-dir': 3, 'plugin-dir': 2, 'json-config': 1 };
      if (priority[plugin.source] > priority[existing.source]) {
        seen.set(plugin.name, plugin);
      }
    }
  }
  return Array.from(seen.values());
}
```

**Delegation Recommendation**:
- Category: `unspecified-low` - Similar to Tasks 5-7
- Skills: [`typescript-programmer`, `git-master`]

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: API logic
- INCLUDED `git-master`: Standard

**Depends On**: Task 4
**Parallel Group**: Wave 2

**Acceptance Criteria**:
- [ ] Plugins endpoint returns plugins from both `plugin/` and `plugins/` directories
- [ ] Each plugin has `source` field ('plugin-dir', 'plugins-dir', or 'json-config')
- [ ] Priority: plugins-dir > plugin-dir > json-config
- [ ] Verify: Plugin from `plugins/` shows `source: 'plugins-dir'`
- [ ] Verify: Plugin from `plugin/` shows `source: 'plugin-dir'`
- [ ] Verify: Duplicate plugin name prefers plural directory version

---

### Task 9: Integration Testing and Verification

**Description**:
Test the complete integration to ensure all location-proof discovery works correctly. Verify all source tracking, deduplication, and API responses.

**Testing Setup**:
Create test directory structure:
```
~/.config/opencode-test/
├── skill/
│   └── native-skill/
│       └── SKILL.md
├── skills/
│   └── external-pkg/
│       └── skills/
│           └── external-skill/
│               └── SKILL.md
├── command/
│   ├── dir-cmd.md
│   └── another-cmd.md
├── mcp/
│   ├── filesystem.json
│   └── github.yaml
├── plugin/
│   └── native-plugin/
│       └── manifest.json
└── plugins/
    └── external-plugin/
        └── manifest.json
```

**Test opencode.json**:
```json
{
  "skills": [{ "name": "json-skill", "content": "..." }],
  "slashCommands": { "json-cmd": "..." },
  "mcpServers": { "json-mcp": { "command": "..." } },
  "plugins": [{ "name": "json-plugin" }]
}
```

**Verification Steps**:
1. Start server with test config
2. Call each API endpoint
3. Verify all items discovered
4. Verify source fields correct
5. Verify deduplication working

**Delegation Recommendation**:
- Category: `unspecified-low` - Integration testing
- Skills: [`typescript-programmer`, `dev-browser`]
  - `typescript-programmer`: Backend verification
  - `dev-browser`: API testing via HTTP requests

**Skills Evaluation**:
- INCLUDED `typescript-programmer`: Test setup and verification
- INCLUDED `dev-browser`: HTTP API testing
- INCLUDED `git-master`: Commit test results
- OMITTED `frontend-ui-ux`: Testing backend APIs

**Depends On**: Task 5, Task 6, Task 7, Task 8
**Parallel Group**: Wave 3 (final)

**Acceptance Criteria**:
- [ ] All API endpoints return expected items
- [ ] Source tracking correctly identifies origin for all items
- [ ] Deduplication prefers correct sources
- [ ] No errors in server logs
- [ ] Verify: Create test structure and confirm discovery works
- [ ] Verify: Check all endpoints return combined results
- [ ] Verify: Screenshot or log of successful API responses

---

## Commit Strategy

| After Task | Commit Message | Files |
|------------|----------------|-------|
| Task 1 | `feat(backend): expand skill discovery to skills/ directories` | `server/index.js` |
| Task 2 | `feat(backend): add command discovery from command/ directories` | `server/index.js` |
| Task 3 | `feat(backend): add MCP discovery from mcp/ directories` | `server/index.js` |
| Task 4 | `feat(backend): expand plugin discovery to plugins/ directories` | `server/index.js` |
| Task 5 | `feat(api): add source tracking to skills endpoint` | `server/index.js` |
| Task 6 | `feat(api): add source tracking to commands endpoint` | `server/index.js` |
| Task 7 | `feat(api): add source tracking to MCPs endpoint` | `server/index.js` |
| Task 8 | `feat(api): add source tracking to plugins endpoint` | `server/index.js` |
| Task 9 | `test(integration): verify location-proof discovery` | Test files, logs |

**Alternative (group commits)**:
- Wave 1 commit: `feat(backend): add directory discovery for skills, commands, MCPs, plugins`
- Wave 2 commit: `feat(api): add source tracking and aggregation for all entity types`
- Wave 3 commit: `test(integration): verify location-proof discovery end-to-end`

---

## Success Criteria

### Automated Verification Commands

```bash
# Test skill discovery
curl -s http://localhost:1920/api/skills | jq '.[] | {name, source}'

# Test command discovery  
curl -s http://localhost:1920/api/commands | jq '.[] | {name, source}'

# Test MCP discovery
curl -s http://localhost:1920/api/mcps | jq '.[] | {name, source}'

# Test plugin discovery
curl -s http://localhost:1920/api/plugins | jq '.[] | {name, source}'
```

### Final Checklist
- [ ] All 8 foundation tasks complete
- [ ] All 4 API endpoint updates complete
- [ ] Integration test passes
- [ ] All items have source tracking
- [ ] Deduplication works correctly
- [ ] No regressions (existing skills/plugins still work)
- [ ] Server starts without errors
- [ ] API responses include expected items from all sources

### Definition of Done
- Skills discovered from: `skill/` (18 skills), `skills/` (external packages)
- Commands discovered from: `command/` (.md files), opencode.json
- MCPs discovered from: `mcp/` (.json/.yaml), opencode.json
- Plugins discovered from: `plugin/`, `plugins/`, opencode.json
- Each item has `source` field indicating origin
- Directory sources take precedence over JSON config
- All discovery functions unit tested
- Integration tests verify end-to-end flow
