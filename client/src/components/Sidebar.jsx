import { Terminal, Box, Puzzle, FileCode, Edit3 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ selectedFile }) {
  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700 flex items-center gap-2">
        <Box className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-bold">Opencode Studio</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <SidebarItem to="/mcp" icon={<Terminal />} label="MCP Servers" />
        <SidebarItem to="/skills" icon={<Puzzle />} label="Skills" />
        <SidebarItem to="/plugins" icon={<FileCode />} label="Plugins" />
        {selectedFile && (
          <SidebarItem to="/editor" icon={<Edit3 />} label={`Editing: ${selectedFile.name}`} />
        )}
      </nav>

      <div className="p-4 border-t border-gray-700 text-xs text-gray-500 text-center">
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, to }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </NavLink>
  )
}
