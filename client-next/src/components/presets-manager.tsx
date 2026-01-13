"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, Plus, MoreVertical, Play, Trash2, Save, Check } from "lucide-react";
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
    } catch {
      toast.error("Failed to create preset");
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
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Preset</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-1 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Coding Mode" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Enables coding skills..." />
              </div>
              
              <div className="border rounded-md p-4">
                <h4 className="text-sm font-medium mb-3">Configuration</h4>
                <Tabs defaultValue="skills">
                  <TabsList className="w-full">
                    <TabsTrigger value="skills" className="flex-1">Skills ({selectedSkills.length})</TabsTrigger>
                    <TabsTrigger value="plugins" className="flex-1">Plugins ({selectedPlugins.length})</TabsTrigger>
                    <TabsTrigger value="mcps" className="flex-1">MCPs ({selectedMcps.length})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="skills" className="h-[200px] overflow-y-auto pt-2 space-y-2">
                    <div className="flex items-center space-x-2 mb-2 p-2 bg-muted/30 rounded sticky top-0 backdrop-blur-sm z-10">
                      <Switch id="include-skills" checked={includeSkills} onCheckedChange={setIncludeSkills} />
                      <Label htmlFor="include-skills" className="cursor-pointer font-medium">Include Skills in Preset</Label>
                    </div>
                    {skills.length === 0 && <p className="text-sm text-muted-foreground italic p-2">No skills found</p>}
                    {skills.map(skill => (
                      <div key={skill.name} className={`flex items-center justify-between p-2 rounded hover:bg-muted/50 ${!includeSkills ? 'opacity-50' : ''}`}>
                        <Label htmlFor={`skill-${skill.name}`} className="flex-1 cursor-pointer">{skill.name}</Label>
                        <Switch 
                          id={`skill-${skill.name}`}
                          checked={selectedSkills.includes(skill.name)}
                          disabled={!includeSkills}
                          onCheckedChange={(c) => {
                            if (c) setSelectedSkills([...selectedSkills, skill.name]);
                            else setSelectedSkills(selectedSkills.filter(s => s !== skill.name));
                          }}
                        />
                      </div>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="plugins" className="h-[200px] overflow-y-auto pt-2 space-y-2">
                    <div className="flex items-center space-x-2 mb-2 p-2 bg-muted/30 rounded sticky top-0 backdrop-blur-sm z-10">
                      <Switch id="include-plugins" checked={includePlugins} onCheckedChange={setIncludePlugins} />
                      <Label htmlFor="include-plugins" className="cursor-pointer font-medium">Include Plugins in Preset</Label>
                    </div>
                    {plugins.length === 0 && <p className="text-sm text-muted-foreground italic p-2">No plugins found</p>}
                    {plugins.map(plugin => (
                      <div key={plugin.name} className={`flex items-center justify-between p-2 rounded hover:bg-muted/50 ${!includePlugins ? 'opacity-50' : ''}`}>
                        <Label htmlFor={`plugin-${plugin.name}`} className="flex-1 cursor-pointer">{plugin.name}</Label>
                        <Switch 
                          id={`plugin-${plugin.name}`}
                          checked={selectedPlugins.includes(plugin.name)}
                          disabled={!includePlugins}
                          onCheckedChange={(c) => {
                            if (c) setSelectedPlugins([...selectedPlugins, plugin.name]);
                            else setSelectedPlugins(selectedPlugins.filter(p => p !== plugin.name));
                          }}
                        />
                      </div>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="mcps" className="h-[200px] overflow-y-auto pt-2 space-y-2">
                    <div className="flex items-center space-x-2 mb-2 p-2 bg-muted/30 rounded sticky top-0 backdrop-blur-sm z-10">
                      <Switch id="include-mcps" checked={includeMcps} onCheckedChange={setIncludeMcps} />
                      <Label htmlFor="include-mcps" className="cursor-pointer font-medium">Include MCPs in Preset</Label>
                    </div>
                    {!config?.mcp || Object.keys(config.mcp).length === 0 ? (
                      <p className="text-sm text-muted-foreground italic p-2">No MCP servers found</p>
                    ) : (
                      Object.keys(config.mcp).map(key => (
                        <div key={key} className={`flex items-center justify-between p-2 rounded hover:bg-muted/50 ${!includeMcps ? 'opacity-50' : ''}`}>
                          <Label htmlFor={`mcp-${key}`} className="flex-1 cursor-pointer">{key}</Label>
                          <Switch 
                            id={`mcp-${key}`}
                            checked={selectedMcps.includes(key)}
                            disabled={!includeMcps}
                            onCheckedChange={(c) => {
                              if (c) setSelectedMcps([...selectedMcps, key]);
                              else setSelectedMcps(selectedMcps.filter(k => k !== key));
                            }}
                          />
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={handleCreate}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
