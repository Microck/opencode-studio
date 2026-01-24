<p align="center">
  <a href="https://github.com/Microck/opencode-studio">
    <img src="client-next/public/logo-dark.png" alt="logo" width="100">
  </a>
</p>

<p align="center">a local gui for managing opencode configurations. toggle mcp servers, edit skills, manage plugins, handle auth - no json editing required.</p>

<p align="center">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
  <a href="https://nextjs.org/"><img alt="next.js" src="https://img.shields.io/badge/next.js-16-black.svg" /></a>
  <a href="https://www.npmjs.com/package/opencode-studio-server"><img alt="npm" src="https://img.shields.io/npm/v/opencode-studio-server.svg" /></a>
  <a href="https://www.npmjs.com/package/opencode-studio-server"><img alt="npm downloads" src="https://badgen.net/npm/dt/opencode-studio-server" /></a>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/487bba2b-a9ea-455b-a2ac-ccc5c3b95af7" alt="preview" width="1000">
</p>

---

### quickstart

#### option 1: public site + local backend (recommended)

```bash
npm install -g opencode-studio-server
```

visit [opencode.micr.dev](https://opencode.micr.dev) and click "Launch Backend" in the sidebar.

#### option 2: fully local

**windows**
```batch
quickstart.bat
```

**macos / linux**
```bash
chmod +x quickstart.sh && ./quickstart.sh
```

open http://localhost:3000

---

### features

- **mcp manager**: toggle servers on/off, add new ones by pasting npx commands, delete unused configs
- **skill editor**: browse/edit skills, create from templates, import from url, bulk import multiple urls
- **plugin hub**: manage js/ts plugins, multiple templates (hooks, watchers, lifecycle), bulk import
- **commands**: browse and manage custom slash commands
- **auth**: proxy management dashboard for CLIProxyAPI (multi-account rotation, rate-limit handling)
- **cloud sync**: sync config across devices via dropbox, google drive, onedrive, or any cloud folder
- **backup/restore**: export/import complete config including skills and plugins
- **settings**: permissions, agents config, keybinds, tui settings, config path management

---

### how it works

```mermaid
flowchart LR
    A[Browser] -->|HTTP| B(Express API :3001)
    B -->|Read/Write| C[~/.config/opencode/]
    C --> D[opencode.json]
    C --> E[skill/]
    C --> F[plugin/]
```

1. **detect**: server finds your opencode config directory automatically
2. **read**: loads opencode.json, skills, plugins, auth
3. **edit**: make changes through the ui
4. **save**: writes back to disk instantly

---

### usage

| route | actions |
|:---|:---|
| `/mcp` | toggle switches, add via npx command, search/filter |
| `/skills` | create from template, bulk import, edit in monaco |
| `/plugins` | pick template, bulk import, click to edit |
| `/commands` | browse custom slash commands |
| `/auth` | proxy status, start/stop CLIProxyAPI, add accounts |
| `/settings` | permissions, agents, keybinds, cloud sync, backup |

---

### bulk import

paste multiple raw github urls (one per line):

```
https://raw.githubusercontent.com/.../skills/brainstorming/SKILL.md
https://raw.githubusercontent.com/.../skills/debugging/SKILL.md
https://raw.githubusercontent.com/.../skills/tdd/SKILL.md
```

click fetch → preview with checkboxes → existing items unchecked → import selected

---

### deep links

| protocol | description |
|:---|:---|
| `opencodestudio://launch` | start backend only |
| `opencodestudio://launch?open=local` | start backend + open localhost:3000 |
| `opencodestudio://install-mcp?name=NAME&cmd=COMMAND` | install mcp server |
| `opencodestudio://import-skill?url=URL` | import skill from url |
| `opencodestudio://import-plugin?url=URL` | import plugin from url |

---

### project structure

```
opencode-studio/
├── client-next/           # next.js 16 frontend
│   ├── src/app/           # pages (mcp, skills, plugins, auth, settings)
│   ├── src/components/    # ui components
│   └── public/            # static assets
├── server/
│   └── index.js           # express api
├── quickstart.bat
├── quickstart.sh
└── package.json           # runs both with concurrently
```

config locations:
- opencode config: `~/.config/opencode/`
- studio data: `~/.config/opencode-studio/`

---

### troubleshooting

| problem | fix |
|:---|:---|
| "opencode not found" | ensure `~/.config/opencode/opencode.json` exists |
| port 3000/3001 in use | kill existing processes or change ports |
| skills not showing | check `~/.config/opencode/skill/` has SKILL.md files |
| bulk import fails | ensure urls are raw github links |
| "Launch Backend" not working | run `npm install -g opencode-studio-server` first |
| protocol handler not registered | run `opencode-studio-server --register` as admin |

---

### license

mit
