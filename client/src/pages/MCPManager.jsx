import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import AddMCPModal from '../components/AddMCPModal';

export default function MCPManager({ config, toggleMCP, deleteMCP, addMCP }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!config) return null;

  return (
      <div className="space-y-4">
        <AddMCPModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onAdd={addMCP}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(config.mcp || {}).map(([key, mcp]) => (
            <div key={key} className={`p-4 rounded-lg border ${mcp.enabled ? 'border-blue-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50'} relative group`}>
              <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{key}</h3>
                  <div className="flex gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={mcp.enabled} onChange={() => toggleMCP(key)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      <button onClick={() => deleteMCP(key)} className="text-gray-500 hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
              </div>
              <p className="text-xs text-gray-400 mb-2 font-mono bg-gray-900 p-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">
                  {mcp.command && mcp.command.join(' ')}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded ${mcp.type === 'local' ? 'bg-purple-900 text-purple-200' : 'bg-green-900 text-green-200'}`}>
                  {mcp.type}
              </span>
            </div>
          ))}
            <div 
              onClick={() => setIsModalOpen(true)}
              className="p-4 rounded-lg border border-gray-700 border-dashed flex flex-col items-center justify-center text-gray-500 hover:bg-gray-800 hover:text-white cursor-pointer transition h-32"
            >
              <Plus size={24} />
              <span className="text-sm mt-2">Add MCP Server</span>
            </div>
        </div>
      </div>
  );
}
