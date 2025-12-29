import { FileCode, Plus } from 'lucide-react';

export default function SkillEditor({ skills, loadFile, createNewFile }) {
    return (
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
    );
}
