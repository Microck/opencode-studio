# Potential Features & Implementation Plan for OpenCode Studio

This document outlines a comprehensive plan for enhancing OpenCode Studio, addressing key gaps between the platform's capabilities (as documented) and the current GUI implementation.

## 1. Agent Builder & Manager (Priority: P0)

**Rationale:**
The OpenCode platform supports a powerful agent system (primary/subagents, custom prompts, tools, permissions), but Studio currently lacks a UI to create or manage them beyond basic model fallbacks. Users must currently edit `opencode.json` or create markdown files manually.

**Utility:** High. Unlocks the core "Agentic" potential of the platform for non-expert users.
**Difficulty:** High. Involves complex state management, file I/O, and validation.

**Implementation Plan:**

*   **Backend (`server/index.js`):**
    *   **New Endpoint:** `GET /api/agents` - Aggregates agents from `opencode.json` ("agent" key) and `~/.config/opencode/agents/*.md`.
    *   **New Endpoint:** `POST /api/agents` - Accepts agent config. If `mode` is provided, decides whether to write to `opencode.json` or a new `.md` file.
    *   **Logic:** Implement a parser for Frontmatter (using `gray-matter` or similar, usually `js-yaml` handling) to read/write `.md` agent definitions.
*   **Frontend (`client-next/src/lib/api.ts`):**
    *   Add `getAgents()`, `saveAgent(agent: AgentConfig)`, `deleteAgent(name: string)`.
*   **UI (`client-next/src/app/agents/page.tsx`):**
    *   **List View:** Grid of agents distinguishing between "Built-in" (Build, Plan), "Config" (JSON), and "File" (Markdown).
    *   **Editor Wizard:**
        *   **Identity:** Name, Description, Color, Icon.
        *   **Mode:** Toggle between Primary (interactive) and Subagent (task-based).
        *   **Prompt:** Monaco editor for the system prompt.
        *   **Tools:** Checklist of enabled tools (merging built-ins and available MCPs).
        *   **Model:** Dropdown to override default model.

---

## 2. Visual Permission Manager (Priority: P0)

**Rationale:**
Security is a major focus in the docs (`ask`, `allow`, `deny`). Editing complex nested permission objects in JSON is error-prone. A visual matrix would provide immediate clarity on what agents can do.

**Utility:** High. Critical for safe operation of powerful agents.
**Difficulty:** Medium. Data modeling is tricky, but UI is straightforward.

**Implementation Plan:**

*   **Backend:**
    *   Ensure `GET /api/config` returns the full `permission` object (already supported).
    *   Update `POST /api/config` validation to strictly check permission values (`ask` | `allow` | `deny`).
*   **Frontend (`client-next/src/components/permission-editor.tsx`):**
    *   **Component:** A reusable table/grid.
        *   **Rows:** Tools (`read`, `edit`, `bash`, `webfetch`, `mcp.*`).
        *   **Columns:** Permission Levels.
        *   **Advanced:** Support for glob patterns (e.g., `bash: { "git *": "allow" }`).
    *   **Integration:** Embed this component in `SettingsPage` (Global Permissions) and the new `AgentBuilder` (Agent-specific overrides).

---

## 3. Live Log Viewer & Debugger (Priority: P1)

**Rationale:**
The server currently watches logs (`server/index.js:setupLogWatcher`) for usage tracking, but users cannot see these logs. A live console is essential for debugging MCP connections, agent "thoughts", and errors.

**Utility:** Medium/High. Vital for "power users" and MCP developers.
**Difficulty:** Medium. Requires real-time communication.

**Implementation Plan:**

*   **Backend (`server/index.js`):**
    *   **SSE Endpoint:** Create `app.get('/api/logs/stream', ...)` that keeps the connection open and writes data when `processLogLine` triggers.
    *   **Buffer:** Keep a small circular buffer (e.g., last 100 lines) to send immediately on connection.
*   **Frontend (`client-next/src/app/logs/page.tsx`):**
    *   **Viewer:** A terminal-like component (using `xterm.js` or a virtualized list).
    *   **Parser:** Highlight lines starting with `[MCP]`, `[Agent]`, `[Error]`.
    *   **Controls:** "Clear", "Pause", "Auto-scroll".

---

## 4. LSP & Formatter Manager (Priority: P1)

**Rationale:**
Docs (`lsp.md`, `formatters.md`) describe built-in support for numerous languages, but manual configuration (disabling specific servers, custom commands) is done via JSON. A UI would make it easier to see what's active and configure paths/args.

**Utility:** High. Enhances the coding experience significantly.
**Difficulty:** Medium. Requires listing known LSPs/Formatters and their status.

**Implementation Plan:**

*   **Backend:**
    *   **Endpoint:** `GET /api/system/tools` - Return list of available binaries (e.g., `go`, `rust-analyzer`, `prettier`) by checking `PATH`.
    *   **Config:** Read/Write `lsp` and `formatter` sections in `opencode.json`.
*   **Frontend (`client-next/src/app/settings/code/page.tsx`):**
    *   **LSP Tab:** List supported LSPs. Toggle "Enabled/Disabled". Input fields for "Command" and "Args" overrides.
    *   **Formatter Tab:** Similar list. Toggle per language.
    *   **Status:** Show "Detected" (green dot) if the binary is found in system PATH.

---

## 5. Project Rules (AGENTS.md) Editor (Priority: P1)

**Rationale:**
`rules.md` explains that `AGENTS.md` is critical for project-specific context. While Studio has a "Global Prompt" editor, it lacks a dedicated view for the *current project's* rules, which take precedence.

**Utility:** High. Essential for tailoring the AI to specific codebases.
**Difficulty:** Low/Medium. Needs file system access to the project root.

**Implementation Plan:**

*   **Backend:**
    *   **Endpoint:** `GET /api/project/rules` - Detects `AGENTS.md` (or `CLAUDE.md`) in the config path's parent directory (or searches up).
    *   **Endpoint:** `POST /api/project/rules` - Saves content.
*   **Frontend (`client-next/src/app/rules/page.tsx`):**
    *   **Editor:** Monaco editor with markdown highlighting.
    *   **Templates:** "Insert Template" button (e.g., "React/Next.js Rules", "Python Script Rules").
    *   **Preview:** Live markdown preview.

---

## 6. ACP Connection Hub (Priority: P2)

**Rationale:**
The docs emphasize ACP (Agent Client Protocol) for IDE integration. Users need an easy way to generate the configuration snippets for Zed, JetBrains, etc., pointing to their specific `opencode` binary.

**Utility:** Medium. Smoothens the onboarding ramp.
**Difficulty:** Low.

**Implementation Plan:**

*   **Backend:**
    *   **Endpoint:** `GET /api/system/info` - Returns path to `opencode` binary.
*   **Frontend (`client-next/src/app/acp/page.tsx`):**
    *   **Tabs:** "Zed", "JetBrains", "Neovim".
    *   **Code Block:** Pre-generated JSON/Lua configuration.
    *   **Status:** Simple check if the ACP server is reachable.

---

## 7. TUI & Keybind Configurator (Priority: P2)

**Rationale:**
Users can customize the TUI heavily. A graphical editor for keybinds prevents conflicts and syntax errors.

**Utility:** Medium. Improves DX for terminal users.
**Difficulty:** Medium. UI complexity for key recording.

**Implementation Plan:**

*   **Frontend (`client-next/src/app/settings/tui/page.tsx`):**
    *   **Keybind Recorder:** Component capturing key presses.
    *   **Conflict Detection:** Warn on duplicates.
    *   **TUI Options:** Sliders for `scroll_speed`, toggles for `diff_style`.

---

## 8. Diagnostics Dashboard (Priority: P2)

**Rationale:**
`troubleshooting.md` suggests checking various states. A centralized "Doctor" page would verify:
1.  Backend connectivity.
2.  Internet access (for remote MCPs).
3.  GitHub Auth status.
4.  LSP binary availability.
5.  Config validity.

**Utility:** Medium. Reduces support friction.
**Difficulty:** Low. Aggregates existing health checks.

**Implementation Plan:**

*   **Frontend (`client-next/src/app/diagnostics/page.tsx`):**
    *   List of health checks with Pass/Fail indicators.
    *   "Copy Report" button for bug reports.

---

## 9. Theme Creator (Priority: P3)

**Rationale:**
Cosmetic customization.

**Utility:** Low.
**Difficulty:** Low.

**Implementation Plan:**

*   **Frontend:** Color pickers and TUI preview.

---

## 10. Preset Gallery (Priority: P3)

**Rationale:**
Quick-start configurations.

**Utility:** Low/Medium.
**Difficulty:** Low.

**Implementation Plan:**

*   **Frontend:** Gallery of preset cards.

---

## Summary Table

| Feature | Priority | Est. Difficulty | Primary Files Touched |
| :--- | :--- | :--- | :--- |
| **Agent Builder** | **P0** | High | `server/index.js`, `client-next/src/app/agents/` |
| **Permission Manager** | **P0** | Medium | `client-next/src/components/`, `settings/page.tsx` |
| **Log Viewer** | **P1** | Medium | `server/index.js` (SSE), `client-next/src/app/logs/` |
| **LSP/Formatter Mgr** | **P1** | Medium | `server/index.js`, `client-next/src/app/settings/code/` |
| **Project Rules Editor**| **P1** | Low | `server/index.js`, `client-next/src/app/rules/` |
| **ACP Hub** | **P2** | Low | `client-next/src/app/acp/` |
| **TUI Editor** | **P2** | Medium | `client-next/src/app/settings/` |
| **Diagnostics** | **P2** | Low | `client-next/src/app/diagnostics/` |
| **Theme Creator** | **P3** | Low | `client-next/src/components/theme-editor.tsx` |
| **Preset Gallery** | **P3** | Low | `client-next/src/app/presets/` |
