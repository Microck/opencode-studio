<p align="center">
  <a href="https://github.com/Microck/opencode-studio">
    <img src="client-next/public/opencode-logo.png" alt="logo" width="200">
  </a>
</p>

<p align="center">a local gui for managing opencode configurations. toggle mcp servers, edit skills, manage plugins, handle auth - no json editing required.</p>

<p align="center">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
  <a href="https://nextjs.org/"><img alt="next.js" src="https://img.shields.io/badge/next.js-16-black.svg" /></a>
  <a href="https://ui.shadcn.com/"><img alt="shadcn" src="https://img.shields.io/badge/shadcn/ui-latest-black.svg" /></a>
</p>

---

### quickstart

**windows**
```batch
quickstart.bat
```

**macos / linux**
```bash
chmod +x quickstart.sh
./quickstart.sh
```

open http://localhost:3000

---

### features

- **mcp manager:** toggle servers on/off, add new ones by pasting npx commands, delete unused configs
- **skill editor:** browse/edit skills, create from templates, import from url, bulk import multiple urls
- **plugin hub:** manage js/ts plugins, multiple templates (hooks, watchers, lifecycle), bulk import
- **auth:** view connected providers, login via oauth/api key, track token expiration
- **settings:** model aliases, permissions, agents, backup/restore, theme toggle
- **bulk import:** paste multiple urls, preview with checkboxes, skip existing items

---

### how it works

```mermaid
flowchart LR
    A[Browser] -->|HTTP| B(Express API :3001)
    B -->|Read/Write| C[~/.config/opencode/]
    C --> D[opencode.json]
    C --> E[skill/]
    C --> F[plugin/]
    A -->|UI| G(Next.js :3000)
    G -->|Fetch| B
```

1. **detect:** server finds your opencode config directory automatically
2. **read:** loads `opencode.json`, skills, plugins, auth
3. **edit:** make changes through the ui
4. **save:** writes back to disk instantly

---

### usage

#### mcp servers
```
/mcp → toggle switches to enable/disable
     → [Add] paste npx command or configure manually
     → search/filter by name
```

#### skills
```
/skills → [New Skill] create from template
        → [Bulk Import] paste multiple urls
        → click card to edit in monaco editor
        → toggle enable/disable
```

#### plugins
```
/plugins → [New Plugin] pick template (basic, hooks, watcher, etc.)
         → [Bulk Import] paste multiple urls
         → click to edit
```

#### auth
```
/auth → view connected providers
      → [Login] opens browser oauth
      → remove credentials
```

---

### bulk import

paste multiple raw github urls (one per line):
```
https://raw.githubusercontent.com/.../skills/brainstorming/SKILL.md
https://raw.githubusercontent.com/.../skills/debugging/SKILL.md
https://raw.githubusercontent.com/.../skills/tdd/SKILL.md
```

click fetch → preview table with checkboxes → existing items unchecked by default → import selected

works for both skills and plugins.

---

### project structure

```
opencode-studio/
├── client-next/           # next.js 16 frontend
│   ├── src/
│   │   ├── app/           # pages (mcp, skills, plugins, auth, settings)
│   │   ├── components/    # ui components
│   │   └── lib/           # api client, context
│   └── public/
├── server/
│   └── index.js           # express api
├── quickstart.bat
├── quickstart.sh
└── package.json           # runs both with concurrently
```

config location: `~/.config/opencode/` (auto-detected)

---

### screenshots

| mcp manager | skill editor |
|:---:|:---:|
| ![mcp](docs/screenshots/mcp-manager.png) | ![skills](docs/screenshots/skill-editor.png) |

| auth | settings |
|:---:|:---:|
| ![auth](docs/screenshots/auth.png) | ![settings](docs/screenshots/settings.png) |

---

### manual install

```bash
git clone https://github.com/Microck/opencode-studio.git
cd opencode-studio

npm install
cd client-next && npm install
cd ../server && npm install
cd ..

npm start
```

- frontend: http://localhost:3000
- api: http://localhost:3001

---

### troubleshooting

| problem | fix |
|:---|:---|
| "opencode not found" | ensure `~/.config/opencode/opencode.json` exists |
| port 3000/3001 in use | kill existing processes or change ports |
| skills not showing | check `~/.config/opencode/skill/` has SKILL.md files |
| bulk import fails | ensure urls are raw github links (raw.githubusercontent.com) |

---

### tech stack

- **frontend:** next.js 16, tailwind css v4, shadcn/ui, geist font
- **backend:** express, node.js
- **storage:** filesystem (reads/writes opencode config directly)

---

### license

mit
