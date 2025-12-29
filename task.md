# Opencode Studio: Next.js + shadcn/ui Migration Plan

## Overview

Migrate Opencode Studio from Vite/React to Next.js 15 with shadcn/ui components.

**Current Stack:** Vite + React 19 + React Router + Tailwind v4 + lucide-react + axios
**Target Stack:** Next.js 15 (App Router) + shadcn/ui + Tailwind v4 + lucide-react

---

## Phase 0: Pre-Migration Setup

### 0.1 Create Next.js Project
```bash
cd opencode-studio
npx create-next-app@latest client-next --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 0.2 Initialize shadcn/ui
```bash
cd client-next
npx shadcn@latest init
```
Config options:
- Style: Default
- Base color: Slate
- CSS variables: Yes

### 0.3 Install Dependencies
```bash
npm install axios lucide-react
npm install -D @types/node
```

---

## Phase 1: Core Infrastructure

### 1.1 Layout Structure
**File:** `src/app/layout.tsx`

Replace root layout with dark theme defaults matching current design.

### 1.2 Sidebar Component
**File:** `src/components/sidebar.tsx`

**shadcn components needed:**
```bash
npx shadcn@latest add button
npx shadcn@latest add tooltip
```

**Migration mapping:**
| Current | shadcn/ui |
|---------|-----------|
| Custom NavLink styles | `Button` variant="ghost" + `cn()` for active state |
| lucide-react icons | Keep as-is |

### 1.3 API Layer
**File:** `src/lib/api.ts`

Centralize axios calls. Keep backend at `localhost:3001`.

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
```

### 1.4 Types
**File:** `src/types/index.ts`

```typescript
interface MCPConfig {
  command?: string[];
  url?: string;
  enabled: boolean;
  type: 'local' | 'sse';
}

interface OpencodeConfig {
  mcp: Record<string, MCPConfig>;
  model?: { aliases: Record<string, { provider: string; model: string }> };
}
```

---

## Phase 2: MCP Manager Page

### 2.1 Route Setup
**File:** `src/app/mcp/page.tsx`

### 2.2 MCP Card Component
**File:** `src/components/mcp-card.tsx`

**shadcn components:**
```bash
npx shadcn@latest add card
npx shadcn@latest add switch
npx shadcn@latest add badge
```

**Migration mapping:**
| Current | shadcn/ui |
|---------|-----------|
| Custom card div | `Card`, `CardHeader`, `CardContent` |
| Custom toggle switch | `Switch` |
| Type badge | `Badge` |
| Delete button | `Button` variant="ghost" size="icon" |

### 2.3 Add MCP Modal
**File:** `src/components/add-mcp-dialog.tsx`

**shadcn components:**
```bash
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add alert
```

**Migration mapping:**
| Current | shadcn/ui |
|---------|-----------|
| Custom modal overlay | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` |
| Custom inputs | `Input` |
| Custom select | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` |
| Error alert | `Alert`, `AlertDescription` |
| Form labels | `Label` |

---

## Phase 3: Skills Page

### 3.1 Route Setup
**File:** `src/app/skills/page.tsx`

### 3.2 Skill Card Component
**File:** `src/components/skill-card.tsx`

**shadcn components:** (already installed)
- `Card`
- `Button`

**Migration:** Simple card grid, click navigates to editor.

---

## Phase 4: Plugins Page

### 4.1 Route Setup
**File:** `src/app/plugins/page.tsx`

### 4.2 Plugin Card Component
**File:** `src/components/plugin-card.tsx`

Same pattern as skills page.

---

## Phase 5: Editor Page

### 5.1 Route Setup
**File:** `src/app/editor/page.tsx`

Use query params or context for selected file.

### 5.2 Editor Component
**File:** `src/components/file-editor.tsx`

**shadcn components:**
```bash
npx shadcn@latest add textarea
npx shadcn@latest add sonner
```

**Migration mapping:**
| Current | shadcn/ui |
|---------|-----------|
| Custom textarea | `Textarea` |
| Status toast | `sonner` (toast notifications) |
| Save button | `Button` |

---

## Phase 6: Settings Page (New)

### 6.1 Route Setup
**File:** `src/app/settings/page.tsx`

### 6.2 Model Aliases Table
**File:** `src/components/model-aliases-table.tsx`

**shadcn components:**
```bash
npx shadcn@latest add table
```

**Features:**
- Display `config.model.aliases`
- Add/Edit/Delete aliases
- Inline editing with `Input`

---

## Phase 7: Polish & Testing

### 7.1 Loading States
**shadcn components:**
```bash
npx shadcn@latest add skeleton
```

Add `Skeleton` components to all pages during data fetch.

### 7.2 Error Handling
**shadcn components:**
```bash
npx shadcn@latest add alert-dialog
```

Replace `confirm()` dialogs with `AlertDialog`.

### 7.3 Responsive Design
Verify all pages work on mobile. Current grid layouts are responsive.

### 7.4 Dark Mode
Already dark by default. Ensure shadcn theme variables match current gray-900 background.

---

## Component Installation Summary

```bash
npx shadcn@latest add button card switch badge dialog input label select alert textarea sonner table skeleton alert-dialog tooltip
```

---

## File Structure (Final)

```
client-next/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (redirect to /mcp)
│   │   ├── mcp/
│   │   │   └── page.tsx
│   │   ├── skills/
│   │   │   └── page.tsx
│   │   ├── plugins/
│   │   │   └── page.tsx
│   │   ├── editor/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── sidebar.tsx
│   │   ├── mcp-card.tsx
│   │   ├── add-mcp-dialog.tsx
│   │   ├── skill-card.tsx
│   │   ├── plugin-card.tsx
│   │   ├── file-editor.tsx
│   │   └── model-aliases-table.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts (cn helper from shadcn)
│   └── types/
│       └── index.ts
```

---

## Migration Order (Recommended)

1. **Phase 0** - Setup (30 min)
2. **Phase 1** - Layout + Sidebar (1 hr)
3. **Phase 2** - MCP Manager (2 hr) - most complex page
4. **Phase 3** - Skills (30 min)
5. **Phase 4** - Plugins (30 min)
6. **Phase 5** - Editor (1 hr)
7. **Phase 6** - Settings (1 hr)
8. **Phase 7** - Polish (1 hr)

**Total estimated time:** 7-8 hours

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Backend CORS issues | Add `localhost:3000` to allowed origins |
| State management complexity | Use React Context or Zustand if needed |
| Tailwind v4 compatibility | shadcn supports v4, verify during init |
| React 19 compatibility | Next.js 15 supports React 19 |

---

## Success Criteria

- [ ] All pages load without errors
- [ ] MCP toggle/add/delete works
- [ ] Skills/Plugins load and edit
- [ ] Editor saves files
- [ ] Settings page manages model aliases
- [ ] No console errors
- [ ] Dark theme consistent
- [ ] Responsive on mobile
