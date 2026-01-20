# Technology Stack

## Languages
- JavaScript (Node.js backend)
- TypeScript (Frontend)

## Frameworks & Libraries
- **Backend**: Express.js
- **Frontend**: Next.js 16, React 19
- **UI**: shadcn/ui, Tailwind CSS v4
- **API Client**: axios
- **Icons**: Lucide React

## Build Tools
- Concurrently (for running multiple services)

## Runtime
- Node.js

## Key Dependencies
- express: Web framework for backend API
- cors: Cross-origin resource sharing
- body-parser: JSON request parsing
- fs/path/os/crypto/child_process: Node.js built-ins for file operations and process spawning
- next: React framework for frontend
- react: UI library
- tailwindcss: Utility-first CSS framework
- @shadcn/ui: Component library
- lucide-react: Icon library
- concurrently: Run multiple npm scripts simultaneously

## Architecture
- **Monorepo**: Single repository with client-next/ and server/ subdirectories
- **Separate Processes**: Frontend (port 3000) and backend (port 3001) run independently
- **File-based Storage**: No database, uses JSON and markdown files in ~/.config/
- **Protocol Handler**: Custom opencodestudio:// URLs for deep linking
