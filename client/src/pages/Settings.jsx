import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Edit2, X, Check } from 'lucide-react';

export default function Settings({ config, saveConfig }) {
  const [aliases, setAliases] = useState([]);
  const [isEditing, setIsEditing] = useState(null); // Key of the alias being edited
  const [newAlias, setNewAlias] = useState({ key: '', provider: 'copilot', model: '' });
  const [editForm, setEditForm] = useState({ key: '', provider: '', model: '' });

  useEffect(() => {
    if (config && config.model && config.model.aliases) {
      setAliases(Object.entries(config.model.aliases).map(([key, value]) => ({
        key,
        ...value
      })));
    }
  }, [config]);

  const handleSave = () => {
    const newAliasesObj = {};
    aliases.forEach(a => {
      newAliasesObj[a.key] = { provider: a.provider, model: a.model };
    });

    const newConfig = {
      ...config,
      model: {
        ...config.model,
        aliases: newAliasesObj
      }
    };
    saveConfig(newConfig);
  };

  const addAlias = () => {
    if (!newAlias.key || !newAlias.model) return;
    const updatedAliases = [...aliases, { ...newAlias }];
    setAliases(updatedAliases);
    setNewAlias({ key: '', provider: 'copilot', model: '' });
    
    // Auto-save or wait for manual save? Let's wait for manual save or trigger it here.
    // Triggering save immediately for better UX
    const newAliasesObj = {};
    updatedAliases.forEach(a => {
      newAliasesObj[a.key] = { provider: a.provider, model: a.model };
    });
    const newConfig = { ...config, model: { ...config.model, aliases: newAliasesObj } };
    saveConfig(newConfig);
  };

  const deleteAlias = (key) => {
    const updatedAliases = aliases.filter(a => a.key !== key);
    setAliases(updatedAliases);
    
    const newAliasesObj = {};
    updatedAliases.forEach(a => {
      newAliasesObj[a.key] = { provider: a.provider, model: a.model };
    });
    const newConfig = { ...config, model: { ...config.model, aliases: newAliasesObj } };
    saveConfig(newConfig);
  };

  const startEdit = (alias) => {
    setIsEditing(alias.key);
    setEditForm({ ...alias });
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setEditForm({ key: '', provider: '', model: '' });
  };

  const saveEdit = () => {
    const updatedAliases = aliases.map(a => a.key === isEditing ? editForm : a);
    setAliases(updatedAliases);
    setIsEditing(null);
    
    const newAliasesObj = {};
    updatedAliases.forEach(a => {
      newAliasesObj[a.key] = { provider: a.provider, model: a.model };
    });
    const newConfig = { ...config, model: { ...config.model, aliases: newAliasesObj } };
    saveConfig(newConfig);
  };

  if (!config) return <div className="p-4 text-gray-400">Loading configuration...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Model Settings</h2>
        {/* Save button if we wanted manual bulk save, but we are doing auto-save on actions for now */}
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-blue-400">Model Aliases</h3>
        <p className="text-sm text-gray-400 mb-6">
          Map specific model IDs to providers. For strict mapping, set the target model name exactly as required.
        </p>

        {/* Add New Alias Form */}
        <div className="flex gap-4 mb-8 bg-gray-900/50 p-4 rounded border border-gray-700 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Alias Key (e.g. gpt-5.2)</label>
            <input 
              type="text" 
              value={newAlias.key}
              onChange={(e) => setNewAlias({...newAlias, key: e.target.value})}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
              placeholder="gpt-5.2"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs text-gray-500 mb-1">Provider</label>
            <select 
              value={newAlias.provider}
              onChange={(e) => setNewAlias({...newAlias, provider: e.target.value})}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
            >
              <option value="copilot">copilot</option>
              <option value="openai">openai</option>
              <option value="anthropic">anthropic</option>
              <option value="gemini">gemini</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Target Model</label>
            <input 
              type="text" 
              value={newAlias.model}
              onChange={(e) => setNewAlias({...newAlias, model: e.target.value})}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
              placeholder="gpt-5.2"
            />
          </div>
          <button 
            onClick={addAlias}
            disabled={!newAlias.key || !newAlias.model}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {/* Aliases Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm">
                <th className="py-3 px-4">Alias Key</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Target Model</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((alias) => (
                <tr key={alias.key} className="border-b border-gray-800 hover:bg-gray-800/50">
                  {isEditing === alias.key ? (
                    <>
                      <td className="p-2">
                        <input 
                          disabled
                          value={editForm.key}
                          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-500 cursor-not-allowed"
                        />
                      </td>
                      <td className="p-2">
                         <select 
                          value={editForm.provider}
                          onChange={(e) => setEditForm({...editForm, provider: e.target.value})}
                          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1"
                        >
                          <option value="copilot">copilot</option>
                          <option value="openai">openai</option>
                          <option value="anthropic">anthropic</option>
                          <option value="gemini">gemini</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input 
                          value={editForm.model}
                          onChange={(e) => setEditForm({...editForm, model: e.target.value})}
                          className="w-full bg-gray-900 border border-blue-500 rounded px-2 py-1"
                        />
                      </td>
                      <td className="p-2 text-right flex justify-end gap-2">
                        <button onClick={saveEdit} className="text-green-400 hover:bg-green-900/30 p-1 rounded"><Check size={16}/></button>
                        <button onClick={cancelEdit} className="text-red-400 hover:bg-red-900/30 p-1 rounded"><X size={16}/></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 font-mono text-blue-300">{alias.key}</td>
                      <td className="py-3 px-4">
                        <span className="bg-gray-900 text-xs px-2 py-1 rounded border border-gray-700">{alias.provider}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">{alias.model}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEdit(alias)} className="text-gray-500 hover:text-blue-400 p-1"><Edit2 size={16}/></button>
                          <button onClick={() => deleteAlias(alias.key)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {aliases.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-500">No aliases configured.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
