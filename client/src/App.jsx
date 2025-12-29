import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import Layout from './components/Layout';
import MCPManager from './pages/MCPManager';
import SkillEditor from './pages/SkillEditor';
import PluginHub from './pages/PluginHub';

const API_URL = 'http://localhost:3001/api';

function App() {
  const navigate = useNavigate();
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

  const addMCP = (key, mcpConfig) => {
    const newConfig = { ...config };
    if (!newConfig.mcp) newConfig.mcp = {};
    newConfig.mcp[key] = mcpConfig;
    saveConfig(newConfig);
  };

  const loadFile = async (type, name) => {
    try {
      const res = await axios.get(`${API_URL}/${type}/${name}`);
      setSelectedFile({ type, name });
      setFileContent(res.data.content);
      navigate('/editor');
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
    navigate('/editor');
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading Opencode Studio...</div>;

  const EditorView = () => (
    <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{selectedFile ? selectedFile.name : 'Editor'}</h2>
            <button onClick={saveFile} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium">
                <Save size={18} /> Save
            </button>
        </div>
        {status && <div className="mb-4 p-2 bg-green-900/50 text-green-200 rounded border border-green-700">{status}</div>}
        <textarea 
            className="flex-1 bg-gray-950 text-gray-200 font-mono p-4 rounded border border-gray-700 focus:border-blue-500 outline-none resize-none"
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            spellCheck="false"
        />
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<Layout selectedFile={selectedFile} />}>
        <Route index element={<Navigate to="/mcp" replace />} />
        <Route path="mcp" element={<MCPManager config={config} toggleMCP={toggleMCP} deleteMCP={deleteMCP} addMCP={addMCP} />} />
        <Route path="skills" element={<SkillEditor skills={skills} loadFile={loadFile} createNewFile={createNewFile} />} />
        <Route path="plugins" element={<PluginHub plugins={plugins} loadFile={loadFile} createNewFile={createNewFile} />} />
        <Route path="editor" element={<EditorView />} />
      </Route>
    </Routes>
  );
}

export default App;