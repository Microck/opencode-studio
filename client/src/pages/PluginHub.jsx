import { Settings, Plus } from 'lucide-react';

export default function PluginHub({ plugins, loadFile, createNewFile }) {
    return (
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
    );
}
