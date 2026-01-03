# COMPONENTS - UI Layer

## OVERVIEW

shadcn/ui components (ui/) + feature components. 30 files total.

## STRUCTURE

```
components/
├── ui/              # shadcn/ui primitives (18 files)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── sidebar.tsx      # Main navigation
├── logo.tsx
├── theme-toggle.tsx
├── mcp-card.tsx     # MCP server display
├── skill-card.tsx   # Skill list item
├── plugin-card.tsx  # Plugin list item
├── file-card.tsx    # Generic file display
├── add-mcp-dialog.tsx
├── add-skill-dialog.tsx
├── add-plugin-dialog.tsx
└── bulk-import-dialog.tsx
```

## CONVENTIONS

- **ui/**: shadcn/ui only. Do not add custom components here.
- **Feature cards**: `{entity}-card.tsx` pattern for list items
- **Dialogs**: `add-{entity}-dialog.tsx` for create forms
- **Variants**: Use cva() for component variants (shadcn pattern)
- **Class merging**: Always use `cn()` from lib/utils

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add shadcn component | `npx shadcn add {name}` → ui/ |
| Entity list item | Create `{name}-card.tsx` |
| Create/edit form | Create `add-{name}-dialog.tsx` |
| Modify nav | `sidebar.tsx:navItems` |

## ANTI-PATTERNS

- Never put business logic in ui/ components
- Never import from app/ in components/
- Never use raw HTML elements when shadcn equivalent exists
