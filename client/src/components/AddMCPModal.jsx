import { useState } from 'react';
import { X } from 'lucide-react';

export default function AddMCPModal({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [type, setType] = useState('local');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name || !command) {
        alert("Please fill in all fields");
        return;
    }

    const commandArray = command.trim().split(' ');

    onAdd(name, {
        command: commandArray,
        enabled: true,
        type: type 
    });
    
    setName('');
    setCommand('');
    setType('local');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg w-full max-w-md shadow-xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-bold mb-4">Add MCP Server</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Server Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., memory-server"
              className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Command</label>
            <input 
              type="text" 
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., npx -y @modelcontextprotocol/server-memory"
              className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Enter the full command to run the server.</p>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
             <select 
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
             >
                <option value="local">Local (stdio)</option>
             </select>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            >
              Add Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
