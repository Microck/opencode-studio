# Refactor & MCP Feature - Handoff

## Goal
Refactor the frontend to use `react-router-dom` for navigation and implement the "Add MCP Server" feature.

## Progress
- [x] Installed `vitest` and set up testing infrastructure.
- [x] Extracted `Sidebar` component.
- [x] Implemented proper routing in `App.jsx` using `Routes`, `Route`, and `useNavigate`.
- [x] Created `MCPManager`, `SkillEditor`, `PluginHub` page components (extracted from `App.jsx`).
- [x] Implemented `AddMCPModal` for adding new MCP servers.
- [x] Integrated `AddMCPModal` into `MCPManager`.
- [x] Updated `App.test.jsx` and `Sidebar.test.jsx` to work with the new router context.
- [x] Verified tests pass.

## What Worked
- Routing refactor is complete and clean.
- "Add MCP Server" UI is functional (adds to config in memory/backend via `addMCP` function in App).
- Navigation to `/editor` works correctly when loading/creating files.

## What Failed / Issues
- Initial tests failed because components using `useNavigate` or `useLocation` were not wrapped in `<BrowserRouter>` in the test files. This was fixed.
- `act(...)` warnings in tests, but tests pass.

## Next Steps
1.  **Start a new session.**
2.  **Verify**: Run the app (`npm start`) and test the "Add MCP Server" flow manually to ensure it persists to `opencode.json`.
3.  **Enhancement**: The `AddMCPModal` currently defaults to `stdio` type. Future work could add SSE support.
4.  **Enhancement**: Add form validation and better error handling for the "Add MCP Server" modal.
