# Usage Dashboard & System Detection Fixes

## 1. System Detection Fixes (Critical)
- **Plugins**: Update `server/index.js` to correctly detect standalone `.js`/`.ts` files in the `plugin/` directory. Ensure recursive or flat scanning matches user expectations.
- **Auth Profiles**: Investigate why `~/.config/opencode-studio/auth-profiles` or `~/.config/opencode/auth.json` are not being read correctly. Ensure paths are cross-platform compatible.
- **Settings**: Verify `oh-my-opencode.json` and `opencode.json` are being loaded and served via `/api/config`.

## 2. Usage Tab - UI/UX Refinement
- **Remove Budget**: Delete the "Budget Utilization" card and related progress bar state.
- **Token Separation**: 
    - Ensure backend sends `inputTokens` and `outputTokens`.
    - Update frontend table and KPI cards to show both.
- **Cost Distribution (Pie Chart)**:
    - Implement grouping logic: Top 5 models get colors, everything else becomes a single "Others" slice in gray.
    - Add a "Show All" toggle or link to expand the list.
- **3D Isometric Graph**:
    - **Visuals**: Fix `obelisk.js` rendering to look truly isometric (adjust camera/point angles).
    - **Theme**: Sync colors with Tailwind's dark mode variables (green/red scale).
    - **Interaction**: Add hover detection (canvas-based mouse tracking) to show tooltips on 3D bars.
- **Granularity & Filtering**:
    - **Time Ranges**: Fix "Last 24h", "Last 7 Days", etc., to actually filter the data on the backend (or frontend if small enough).
    - **Project Filter**: Wire the `projectId` select to the API call.
    - **Scale**: Implement `Daily`, `Weekly`, `Monthly`, `All Time` bucket logic in the backend.

## 3. Layout Fixes
- **Model Performance**: Fix the table container to prevent cutoff. Use responsive overflow and ensure it fills the available height without breaking the layout.
- **"Middle Thingy"**: Identify and remove unnecessary spacers or redundant widgets between the header and the main charts.

## 4. Implementation Steps
1. **Backend**:
    - Refactor `/api/usage` to support `?projectId=`, `?granularity=`, and `?range=`.
    - Improve plugin/auth path detection.
2. **Frontend**:
    - Update `api.ts` to pass new parameters.
    - Clean up `UsagePage.tsx` layout and remove budget components.
    - Refactor `IsometricHeatmap.tsx` for better visuals and interaction.
    - Implement "Others" grouping in Pie Chart.
