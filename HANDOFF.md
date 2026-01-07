# Session Handoff

## Completed Tasks
- **Refined Pricing Logic**: Updated `client-next/src/lib/data/pricing.ts` to export `calculateDetailedCost`, allowing split reporting of input vs. output costs.
- **Enhanced Usage Chart Interaction**:
  - **Hover State**: Added `hoveredModel` state to track which stacked bar segment is being hovered.
  - **Dynamic Tooltip**: The tooltip now intelligently switches context:
    - If hovering a specific model segment: Shows Name, Input Cost, Output Cost, and Total Cost for *that* model only.
    - If hovering the general axis/background: Shows a daily Total summary.
  - **Visual Feedback**: Added an outline effect (white stroke) to the hovered bar segment to clearly indicate selection.
  - **Cursor Follow**: Removed explicit cursor positioning to ensure the tooltip follows the mouse pointer naturally.

## Verification
- Code changes applied successfully.
- Playwright verified page load stability.
- Visual behavior (outline + specific data) requires manual interaction to appreciate fully.

## Next Steps
- Verify the "Input Tokens cost" label matches user expectation (currently showing "Input Cost" with currency formatting).
