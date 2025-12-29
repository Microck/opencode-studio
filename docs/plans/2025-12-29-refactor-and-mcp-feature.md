# Opencode Studio Refactor & Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Refactor the frontend into a modular architecture using React Router, and implement the missing "Add MCP Server" functionality.

**Architecture:**
- **Frontend:** Modular React components (Sidebar, Layout, Pages) using `react-router-dom` for navigation.
- **State:** Lifted state or Context for global config, local state for forms.
- **Testing:** `vitest` for unit/component testing to ensure regression safety during refactor.

**Tech Stack:** React 19, Vite, Tailwind CSS, React Router v7, Vitest.

### Task 1: Setup Testing Infrastructure

**Files:**
- Create: `client/vitest.config.js`
- Create: `client/src/test/setup.js`
- Create: `client/src/App.test.jsx`
- Modify: `client/package.json`

**Step 1: Install dependencies**
```bash
cd client && npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

**Step 2: Configure Vitest**
Create `client/vitest.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true
  }
});
```

Create `client/src/test/setup.js`:
```javascript
import '@testing-library/jest-dom';
```

**Step 3: Add Smoke Test**
Create `client/src/App.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock child components or axios if needed for a shallow smoke test
// For now, let's just see if it crashes.
// We might need to mock axios since App calls fetchData on mount.
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} }))
  }
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Loading Opencode Studio/i)).toBeInTheDocument();
  });
});
```

**Step 4: Run tests**
Run: `cd client && npx vitest run`
Expected: PASS

**Step 5: Commit**
```bash
git add client/package.json client/vitest.config.js client/src
git commit -m "chore: setup vitest testing infrastructure"
```

### Task 2: Extract Sidebar Component

**Files:**
- Create: `client/src/components/Sidebar.jsx`
- Modify: `client/src/App.jsx`
- Test: `client/src/components/Sidebar.test.jsx`

**Step 1: Write failing test**
Create `client/src/components/Sidebar.test.jsx`.
```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('renders navigation items', () => {
    render(<Sidebar activeTab="mcp" setActiveTab={() => {}} />);
    expect(screen.getByText('MCP Servers')).toBeInTheDocument();
  });
});
```
Expected: FAIL (Module not found)

**Step 2: Implement Sidebar**
Extract `Sidebar` and `SidebarItem` from `App.jsx` to `client/src/components/Sidebar.jsx`.

**Step 3: Refactor App.jsx**
Import `Sidebar` and replace the inline code.

**Step 4: Verify**
Run: `cd client && npx vitest run`
Expected: PASS

**Step 5: Commit**
```bash
git add client/src/components/Sidebar.jsx client/src/App.jsx client/src/components/Sidebar.test.jsx
git commit -m "refactor: extract Sidebar component"
```

### Task 3: Implement Routing & Layout

**Files:**
- Create: `client/src/components/Layout.jsx`
- Modify: `client/src/App.jsx`
- Modify: `client/src/main.jsx`

**Step 1: Create Layout**
`client/src/components/Layout.jsx`:
```jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
         <Outlet />
      </div>
    </div>
  );
}
```
*Note: You'll need to update Sidebar to use `NavLink` or similar if completely switching to router, or keep passing props if managing state centrally. For this refactor, let's use `react-router-dom`'s `NavLink`.*

**Step 2: Update Sidebar to use Router**
Modify `client/src/components/Sidebar.jsx` to use `Link` or `useNavigate`.

**Step 3: Update App.jsx to be the Router Root**
Wrap everything in `BrowserRouter` (in `main.jsx` or `App.jsx`).
Define Routes.

**Step 4: Verify**
Manual check + update tests.

**Step 5: Commit**
```bash
git add client/src/components/Layout.jsx client/src/App.jsx client/src/main.jsx client/src/components/Sidebar.jsx
git commit -m "feat: implement react-router navigation"
```

### Task 4: Extract Feature Pages

**Files:**
- Create: `client/src/pages/MCPManager.jsx`
- Create: `client/src/pages/SkillEditor.jsx`
- Create: `client/src/pages/PluginHub.jsx`
- Modify: `client/src/App.jsx`

**Step 1: Extract Pages**
Move respective logic from `App.jsx` to these new files.

**Step 2: Update Router in App.jsx**
Use the new page components in the Route definitions.

**Step 3: Commit**
```bash
git add client/src/pages/ client/src/App.jsx
git commit -m "refactor: extract feature pages"
```

### Task 5: Implement 'Add MCP Server' Feature

**Files:**
- Modify: `client/src/pages/MCPManager.jsx`
- Create: `client/src/components/AddMCPModal.jsx`

**Step 1: Create Modal UI**
`client/src/components/AddMCPModal.jsx`

**Step 2: Integrate Modal in MCPManager**
Add state for `isModalOpen`.
Add `AddMCPModal` component to render tree.

**Step 3: Implement Save Logic**
Call API to save config.

**Step 4: Commit**
```bash
git add client/src/pages/MCPManager.jsx client/src/components/AddMCPModal.jsx
git commit -m "feat: implement add mcp server functionality"
```
