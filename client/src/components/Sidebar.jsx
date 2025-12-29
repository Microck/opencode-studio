import { Terminal, Box, Puzzle, FileCode, Edit3 } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, selectedFile }) {
  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700 flex items-center gap-2">
        <Box className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-bold">Opencode Studio</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <SidebarItem icon={<Terminal />} label="MCP Servers" active={activeTab === 'mcp'} onClick={() => setActiveTab('mcp')} />
        <SidebarItem icon={<Puzzle />} label="Skills" active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} />
        <SidebarItem icon={<FileCode />} label="Plugins" active={activeTab === 'plugins'} onClick={() => setActiveTab('plugins')} />
        {selectedFile && (
          <SidebarItem icon={<Edit3 />} label={`Editing: ${selectedFile.name}`} active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} />
        )}
      </nav>

      <div className="p-4 border-t border-gray-700 text-xs text-gray-500 text-center">
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
