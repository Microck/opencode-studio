# Brainstorm: Model Alias Configuration UI

## Goal
Expose the "Model Alias" configuration (currently manually edited in `opencode.json`) to the user via the Opencode Studio UI.

## Current Configuration Structure
```json
"model": {
  "aliases": {
    "claude-3-5-sonnet": { "provider": "copilot", "model": "claude-3-5-sonnet" },
    "gpt-4o": { "provider": "copilot", "model": "gpt-4o" }
  }
}
```

## Proposal 1: Settings Page
Create a dedicated `Settings` page.
- **Route**: `/settings`
- **Sidebar Icon**: `Settings` (Lucide React)
- **Sections**:
    - **General**: (Future use)
    - **Model Aliases**:
        - List existing aliases.
        - **Add Alias** button.
        - **Edit** (inline or modal).
        - **Delete** button.

### Model Alias Component Design
- **Table / List View**:
    - Columns: **Alias Name** (e.g., `claude-3-5-sonnet`), **Target Provider** (e.g., `copilot`), **Target Model** (e.g., `claude-3-5-sonnet`).
    - Actions: Edit, Delete.
- **Add/Edit Form**:
    - **Alias Name**: Text input (Dropdown if we have a list of known aliasable models?).
    - **Provider**: Dropdown (`copilot`, `anthropic`, `openai`, `ollama`, etc.).
    - **Target Model**: Text input (or dropdown based on provider?).

## Proposal 2: "Models" Page
Instead of a generic "Settings" page, a top-level "Models" page might be more appropriate if we plan to expand model configuration (e.g., API keys, default models).
- **Route**: `/models`
- **Sidebar Icon**: `Bot` or `Cpu` (Lucide React)
- **Features**:
    - Similar to Proposal 1, but dedicated to model configuration.

## Recommended Approach
**Proposal 1 (Settings Page)** is a good starting point as it is extensible for other app-wide settings.

## Implementation Steps (Future Session)
1.  **Frontend**:
    -   Create `client/src/pages/Settings.jsx`.
    -   Add `/settings` route in `App.jsx`.
    -   Update `Sidebar.jsx` to include the link.
    -   Implement the Model Alias management UI in `Settings.jsx`.
2.  **Backend**:
    -   The existing `POST /api/config` endpoint can already handle updates, but we might want a specific helper or validation on the frontend to ensure we don't overwrite other config sections accidentally (though the current `saveConfig` in `App.jsx` writes the whole config object).

## Data Structure in State
`config.model.aliases` is an object where keys are alias names.
Convert to array for rendering: `Object.entries(config.model.aliases || {})`.
