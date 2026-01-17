# Session Handoff - Auth UI Redesign (v1.11.0)

## Status
Redesigned Auth page with Vercel-style minimalism and improved hierarchy. Bumped to **v1.11.0**.

## Changes (v1.11.0)

### 1. Design Overhaul
- **Layout**: Moved to a split layout (Main Content + Sidebar) for better hierarchy.
- **Account Pool**: Replaced card grid with a clean, border-separated list view (Vercel-style).
- **Status Indicators**: Switched from pills/badges to minimal status dots.
- **Typography**: Optimized for data density (monospace numbers) and readability.
- **Plugin Switcher**: Redesigned as a compact segmented control.

### 2. Functional Improvements
- **Actions**: "Rotate" renamed to "Next" for clarity.
- **Connect State**: "Connect Google" is now a clear empty state block.
- **Clear All**: Retained and styled consistently.

## Verification
- **Visual Check**: Verify the page looks cleaner, with high contrast borders and less "card" clutter.
- **Functionality**: Ensure all buttons (Next, Switch, Add, Clear) still work with the new layout.

## Next Steps
- **Restart Server**: Required for v1.11.0.
- **Run build**: `cd client-next && npm run build`.
