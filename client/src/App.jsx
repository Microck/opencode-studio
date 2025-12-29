import { useState, useEffect } from 'react';
import axios from 'axios';
import { Terminal, Box, Puzzle, FileCode, Settings, Save, Plus, Trash2, Edit3, X } from 'lucide-react';
import Sidebar from './components/Sidebar';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [activeTab, setActiveTab] = useState('mcp');
  const [config, setConfig] = useState(null);
  const [skills, setSkills] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null); // For editor
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, skillsRes, pluginsRes] = await Promise.all([
        axios.get(`${API_URL}/config`),
        axios.get(`${API_URL}/skills`),
        axios.get(`${API_URL}/plugins`)
      ]);
      setConfig(configRes.data);
      setSkills(skillsRes.data);
      setPlugins(pluginsRes.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setStatus('Error connecting to backend');
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      await axios.post(`${API_URL}/config`, newConfig);
      setConfig(newConfig);
      setStatus('Config saved successfully!');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Failed to save config');
    }
  };

  const toggleMCP = (key) => {
    if (!config || !config.mcp) return;
    const newConfig = { ...config };
    if (newConfig.mcp[key]) {
      newConfig.mcp[key].enabled = !newConfig.mcp[key].enabled;
      saveConfig(newConfig);
    }
  };

  const deleteMCP = (key) => {
    if (!confirm(`Delete MCP ${key}?`)) return;
    const newConfig = { ...config };
    delete newConfig.mcp[key];
    saveConfig(newConfig);
  }

  const loadFile = async (type, name) => {
    try {
      const res = await axios.get(`${API_URL}/${type}/${name}`);
      setSelectedFile({ type, name });
      setFileContent(res.data.content);
      setActiveTab('editor');
    } catch (err) {
      alert("Failed to load file");
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      await axios.post(`${API_URL}/${selectedFile.type}/${selectedFile.name}`, { content: fileContent });
      setStatus(`Saved ${selectedFile.name}`);
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('Failed to save file');
    }
  };

  const createNewFile = (type) => {
    const name = prompt(`Enter new ${type === 'skills' ? 'Skill' : 'Plugin'} name (e.g., my-skill.md):`);
    if (!name) return;
    setSelectedFile({ type, name });
    setFileContent(type === 'skills' ? '# New Skill' : '// New Plugin');
    setActiveTab('editor');
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading Opencode Studio...</div>;

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        selectedFile={selectedFile} 
      />

      <div className="w-64 hidden bg-gray-800 border-r border-gray-700 flex-col"> 
         <div className="p-4 border-t border-gray-700 text-xs text-gray-500 text-center">
            {status && <span className="text-green-400">{status}</span>}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold capitalize">{activeTab === 'mcp' ? 'MCP Configuration' : activeTab}</h2>
          {activeTab === 'editor' && (
             <div className="flex gap-2">
                <button onClick={() => setSelectedFile(null)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm flex items-center gap-1">
                   <X size={14} /> Close
                </button>
                <button onClick={saveFile} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center gap-1">
                   <Save size={14} /> Save
                </button>
             </div>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6 bg-gray-900">
          
          {/* MCP TAB */}
          {activeTab === 'mcp' && config && (
            <div className="space-y-4">
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
                 {/* Add New Placeholder */}
                 <div className="p-4 rounded-lg border border-gray-700 border-dashed flex flex-col items-center justify-center text-gray-500 hover:bg-gray-800 hover:text-white cursor-pointer transition h-32">
                    <Plus size={24} />
                    <span className="text-sm mt-2">Add MCP Server</span>
                 </div>
              </div>
            </div>
          )}

          {/* SKILLS TAB */}
          {activeTab === 'skills' && (
            <div>
                <div className="flex justify-between mb-4">
                    <h3 className="text-xl">My Skills</h3>
                    <button onClick={() => createNewFile('skills')} className="px-3 py-1 bg-green-600 rounded flex items-center gap-2 text-sm"><Plus size={16}/> New Skill</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {skills.map(skill => (
                        <div key={skill} onClick={() => loadFile('skills', skill)} className="p-4 bg-gray-800 border border-gray-700 rounded hover:border-blue-500 cursor-pointer transition">
                            <div className="flex items-center gap-2 mb-2">
                                <FileCode className="text-yellow-500" size={20} />
                                <span className="font-mono text-sm">{skill}</span>
                            </div>
                        </div>
                    ))}
                     {skills.length === 0 && <p className="text-gray-500 italic">No skills found.</p>}
                </div>
            </div>
          )}

          {/* PLUGINS TAB */}
          {activeTab === 'plugins' && (
            <div>
                 <div className="flex justify-between mb-4">
                    <h3 className="text-xl">Local Plugins</h3>
                    <button onClick={() => createNewFile('plugins')} className="px-3 py-1 bg-green-600 rounded flex items-center gap-2 text-sm"><Plus size={16}/> New Plugin</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {plugins.map(plugin => (
                        <div key={plugin} onClick={() => loadFile('plugins', plugin)} className="p-4 bg-gray-800 border border-gray-700 rounded hover:border-blue-500 cursor-pointer transition">
                            <div className="flex items-center gap-2 mb-2">
                                <Settings className="text-purple-500" size={20} />
                                <span className="font-mono text-sm">{plugin}</span>
                            </div>
                        </div>
                    ))}
                     {plugins.length === 0 && <p className="text-gray-500 italic">No local plugins found.</p>}
                </div>
            </div>
          )}

          {/* EDITOR TAB */}
          {activeTab === 'editor' && (
            <div className="h-full flex flex-col">
                <textarea 
                    className="flex-1 bg-gray-950 text-gray-200 font-mono p-4 rounded border border-gray-700 focus:border-blue-500 outline-none resize-none"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    spellCheck="false"
                />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;