"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Layers, Plus, MoreVertical, Play, Trash2, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { getPresets, savePreset, deletePreset, applyPreset } from "@/lib/api";
import type { Preset } from "@/types";

export default function PresetsPage() {
  const { config, skills, plugins, refreshData } = useApp();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadPresets = async () => {
    try {
      const data = await getPresets();
      setPresets(data);
    } catch {
      toast.error("Failed to load presets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error("Name is required");
    
    // Capture current state
    const currentSkills = skills.filter(s => s.enabled).map(s => s.name);
    const currentPlugins = plugins.filter(p => p.enabled).map(p => p.name);
    const currentMcps = config?.mcp ? Object.entries(config.mcp).filter(([_, c]) => c.enabled).map(([k]) => k) : [];
    
    try {
      await savePreset(newName, newDesc, {
        skills: currentSkills,
        plugins: currentPlugins,
        mcps: currentMcps,
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
      refreshData(); // Refresh global app state
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Presets</h1>
          <p className="text-muted-foreground text-sm">Save and toggle groups of skills, plugins, and MCPs.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Preset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Preset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Coding Mode" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Enables coding skills..." />
              </div>
              <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground">
                <p className="font-semibold mb-1">Captures current state:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>{skills.filter(s => s.enabled).length} enabled skills</li>
                  <li>{plugins.filter(p => p.enabled).length} enabled plugins</li>
                  <li>{config?.mcp ? Object.values(config.mcp).filter(c => c.enabled).length : 0} enabled MCPs</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Save Current State</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {presets.length === 0 && !loading && (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No presets yet</h3>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm mx-auto">
            Configure your environment (enable skills, plugins, etc.) then click "New Preset" to save the configuration.
          </p>
        </div>
      )}

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
                  {preset.description && <CardDescription className="mt-1">{preset.description}</CardDescription>}
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
    </div>
  );
}
