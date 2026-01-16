"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Layers, Plus, MoreVertical, Play, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getPresets, savePreset, deletePreset, applyPreset } from "@/lib/api";
import type { Preset } from "@/types";

export function PresetsManager() {
  const { config, skills, plugins, refreshData } = useApp();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);
  const [selectedMcps, setSelectedMcps] = useState<string[]>([]);

  const [includeSkills, setIncludeSkills] = useState(true);
  const [includePlugins, setIncludePlugins] = useState(true);
  const [includeMcps, setIncludeMcps] = useState(true);

  useEffect(() => {
    if (createOpen) {
      // Initialize with currently enabled items
      setSelectedSkills(skills.filter(s => s.enabled).map(s => s.name));
      setSelectedPlugins(plugins.filter(p => p.enabled).map(p => p.name));
      setSelectedMcps(config?.mcp ? Object.entries(config.mcp).filter(([_, c]) => c.enabled).map(([k]) => k) : []);
      
      setIncludeSkills(true);
      setIncludePlugins(true);
      setIncludeMcps(true);
    }
  }, [createOpen, skills, plugins, config]);

  const loadPresets = async () => {
    try {
      const data = await getPresets();
      setPresets(data);
    } catch {
      toast.error("Failed to load presets");
    }
  };

  useEffect(() => {
    if (open) loadPresets();
  }, [open]);

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error("Name is required");
    
    try {
      await savePreset(newName, newDesc, {
        skills: includeSkills ? selectedSkills : undefined,
        plugins: includePlugins ? selectedPlugins : undefined,
        mcps: includeMcps ? selectedMcps : undefined,
        commands: []
      });
      toast.success("Preset created");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      loadPresets();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Unknown error";
      toast.error(`Failed to create preset: ${msg}`);
    }
  };

  const handleApply = async (id: string, mode: 'exclusive' | 'additive') => {
    try {
      await applyPreset(id, mode);
      toast.success(`Preset applied (${mode})`);
      refreshData();
      setOpen(false); // Close dialog on success
    } catch {
      toast.error("Failed to apply preset");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this preset?")) return;
    try {
      await deletePreset(id);
      toast.success("Preset deleted");
      loadPresets();
    } catch {
      toast.error("Failed to delete preset");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Layers className="h-4 w-4 mr-2" />
            Presets
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[65vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Presets Manager</DialogTitle>
            <DialogDescription>
              Save the current configuration as a preset, or apply existing ones.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-1 py-4">
            {presets.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No presets yet</h3>
                <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm mx-auto">
                  Configure your environment (enable skills, plugins, etc.) then click "New Preset" below.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {presets.map(preset => (
                  <Card key={preset.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            {preset.name}
                          </CardTitle>
                          {preset.description && <CardDescription className="mt-1 line-clamp-2">{preset.description}</CardDescription>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDelete(preset.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground mb-4 space-y-1 bg-muted/30 p-2 rounded">
                        <p>• {(preset.config.skills || []).length} skills</p>
                        <p>• {(preset.config.plugins || []).length} plugins</p>
                        <p>• {(preset.config.mcps || []).length} MCPs</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1 text-xs"
                          onClick={() => handleApply(preset.id, 'exclusive')}
                          title="Enables these items and DISABLES all others"
                        >
                          <Play className="h-3 w-3 mr-1.5" />
                          Exclusive
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="flex-1 text-xs"
                          onClick={() => handleApply(preset.id, 'additive')}
                          title="Enables these items (keeps others active)"
                        >
                          <Plus className="h-3 w-3 mr-1.5" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
             <Button onClick={() => setCreateOpen(true)}>
               <Plus className="h-4 w-4 mr-2" />
               New Preset
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Preset</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Coding Mode" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Enables coding skills..." />
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[400px]">
                <div className="border rounded-md flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                    <Label htmlFor="include-skills" className="cursor-pointer font-medium text-sm">Skills</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectedSkills.length}/{skills.length}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          if (selectedSkills.length === skills.length) setSelectedSkills([]);
                          else setSelectedSkills(skills.map(s => s.name));
                        }}
                      >
                        {selectedSkills.length === skills.length ? "None" : "All"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[65vh] p-2 space-y-1">
                    {skills.length === 0 && <p className="text-xs text-muted-foreground italic p-2">No skills found</p>}
                    {skills.map(skill => (
                      <div key={skill.name} className="flex items-start justify-between gap-3 p-2 rounded hover:bg-muted/50 text-sm">
                        <label htmlFor={`skill-${skill.name}`} className="flex-1 min-w-0 cursor-pointer whitespace-normal break-words leading-tight" title={skill.name}>{skill.name}</label>
                        <Switch 
                          id={`skill-${skill.name}`}
                          checked={selectedSkills.includes(skill.name)}
                          className="shrink-0"
                          onCheckedChange={(c) => {
                            if (c) setSelectedSkills([...selectedSkills, skill.name]);
                            else setSelectedSkills(selectedSkills.filter(s => s !== skill.name));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-md flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                    <Label htmlFor="include-plugins" className="cursor-pointer font-medium text-sm">Plugins</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectedPlugins.length}/{plugins.length}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          if (selectedPlugins.length === plugins.length) setSelectedPlugins([]);
                          else setSelectedPlugins(plugins.map(p => p.name));
                        }}
                      >
                        {selectedPlugins.length === plugins.length ? "None" : "All"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[65vh] p-2 space-y-1">
                    {plugins.length === 0 && <p className="text-xs text-muted-foreground italic p-2">No plugins found</p>}
                    {plugins.map(plugin => (
                      <div key={plugin.name} className="flex items-start justify-between gap-3 p-2 rounded hover:bg-muted/50 text-sm">
                        <label htmlFor={`plugin-${plugin.name}`} className="flex-1 min-w-0 cursor-pointer whitespace-normal break-words leading-tight" title={plugin.name}>{plugin.name}</label>
                        <Switch 
                          id={`plugin-${plugin.name}`}
                          checked={selectedPlugins.includes(plugin.name)}
                          className="shrink-0"
                          onCheckedChange={(c) => {
                            if (c) setSelectedPlugins([...selectedPlugins, plugin.name]);
                            else setSelectedPlugins(selectedPlugins.filter(p => p !== plugin.name));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-md flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                    <Label htmlFor="include-mcps" className="cursor-pointer font-medium text-sm">MCPs</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectedMcps.length}/{config?.mcp ? Object.keys(config.mcp).length : 0}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          const allKeys = config?.mcp ? Object.keys(config.mcp) : [];
                          if (selectedMcps.length === allKeys.length) setSelectedMcps([]);
                          else setSelectedMcps(allKeys);
                        }}
                      >
                        {selectedMcps.length === (config?.mcp ? Object.keys(config.mcp).length : 0) ? "None" : "All"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[65vh] p-2 space-y-1">
                    {!config?.mcp || Object.keys(config.mcp).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-2">No MCP servers found</p>
                    ) : (
                      Object.keys(config.mcp).map(key => (
                        <div key={key} className="flex items-start justify-between gap-3 p-2 rounded hover:bg-muted/50 text-sm">
                          <label htmlFor={`mcp-${key}`} className="flex-1 min-w-0 cursor-pointer whitespace-normal break-words leading-tight" title={key}>{key}</label>
                          <Switch 
                            id={`mcp-${key}`}
                            checked={selectedMcps.includes(key)}
                            className="shrink-0"
                            onCheckedChange={(c) => {
                              if (c) setSelectedMcps([...selectedMcps, key]);
                              else setSelectedMcps(selectedMcps.filter(k => k !== key));
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
