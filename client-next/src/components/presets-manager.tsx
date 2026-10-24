"use client";

import { mcpServers, mcpEnabled } from "@/lib/mcp-config";

import { errorMessage } from "@/lib/error-message.mjs";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CardStack, Plus, Menu, Play, Trash } from "@nsmr/pixelart-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getPresets, savePreset, deletePreset, applyPreset } from "@/lib/api";
import type { Preset } from "@/types";

export function PresetsManager() {
  const t = useTranslations("common");
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);

  const openCreateDialog = () => {
    setSelectedSkills(skills.filter(s => s.enabled).map(s => s.name));
    setSelectedPlugins(plugins.filter(p => p.enabled).map(p => p.name));
    setSelectedMcps(config?.mcp ? Object.entries(mcpServers(config)).filter(([, c]) => mcpEnabled(c)).map(([key]) => key) : []);
    setIncludeSkills(true);
    setIncludePlugins(true);
    setIncludeMcps(true);
    setCreateOpen(true);
  };

  const loadPresets = useCallback(() => getPresets().then(setPresets)
    .catch(() => { toast.error(t("presets.failedToLoad")); }), [t]);

  useEffect(() => {
    if (open) void loadPresets();
  }, [open, loadPresets]);

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error(t("presets.nameRequired"));
    
    try {
      await savePreset(newName, newDesc, {
        skills: includeSkills ? selectedSkills : undefined,
        plugins: includePlugins ? selectedPlugins : undefined,
        mcps: includeMcps ? selectedMcps : undefined,
        commands: []
      });
      toast.success(t("presets.presetCreated"));
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      loadPresets();
    } catch (err: unknown) {
      const msg = errorMessage(err, "Unknown error");
      toast.error(t("presets.failedToCreate", { msg }));
    }
  };

  const handleApply = async (id: string, mode: 'exclusive' | 'additive') => {
    try {
      await applyPreset(id, mode);
      toast.success(t("presets.presetApplied", { mode }));
      refreshData();
      setOpen(false); // Close dialog on success
    } catch {
      toast.error(t("presets.failedToApply"));
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deletePreset(deleteTarget.id);
      toast.success(t("presets.presetDeleted"));
      setDeleteDialogOpen(false);
      loadPresets();
    } catch {
      toast.error(t("presets.failedToDelete"));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <CardStack className="h-4 w-4 mr-2" />
            {t("presets.presetsBtn")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[65vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("presets.managerTitle")}</DialogTitle>
            <DialogDescription>
              {t("presets.managerDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-1 py-4">
            {presets.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <CardStack className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">{t("presets.noPresetsYet")}</h3>
                <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm mx-auto">
                  {t("presets.noPresetsHint")}
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
                            <CardStack className="h-4 w-4 text-muted-foreground" />
                            {preset.name}
                          </CardTitle>
                          {preset.description && <CardDescription className="mt-1 line-clamp-2">{preset.description}</CardDescription>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Menu className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDelete(preset.id, preset.name)} className="text-destructive">
                               <Trash className="h-4 w-4 mr-2" />
                              {t("presets.delete")}
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground mb-4 space-y-1 bg-muted/30 p-2 rounded">
                        <p>• {t("presets.skillsCount", { count: (preset.config.skills || []).length })}</p>
                        <p>• {t("presets.pluginsCount", { count: (preset.config.plugins || []).length })}</p>
                        <p>• {t("presets.mcpsCount", { count: (preset.config.mcps || []).length })}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1 text-xs"
                          onClick={() => handleApply(preset.id, 'exclusive')}
                          title={t("presets.exclusiveTitle")}
                        >
                          <Play className="h-3 w-3 mr-1.5" />
                          {t("presets.exclusive")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleApply(preset.id, 'additive')}
                          title={t("presets.additiveTitle")}
                        >
                          <Plus className="h-3 w-3 mr-1.5" />
                          {t("presets.additive")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
             <Button onClick={openCreateDialog}>
               <Plus className="h-4 w-4 mr-2" />
               {t("presets.newPreset")}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-[1400px] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("presets.createPreset")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("presets.name")}</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t("presets.namePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("presets.description")}</Label>
                  <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t("presets.descPlaceholder")} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full min-h-[400px]">
                <div className="border rounded-md flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                    <Label htmlFor="include-skills" className="cursor-pointer font-medium text-sm">{t("presets.skills")}</Label>
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
                        {selectedSkills.length === skills.length ? t("presets.none") : t("presets.all")}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[65vh] p-2 space-y-1">
                    {skills.length === 0 && <p className="text-xs text-muted-foreground italic p-2">{t("presets.noSkillsFound")}</p>}
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
                    <Label htmlFor="include-plugins" className="cursor-pointer font-medium text-sm">{t("presets.plugins")}</Label>
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
                        {selectedPlugins.length === plugins.length ? t("presets.none") : t("presets.all")}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[65vh] p-2 space-y-1">
                    {plugins.length === 0 && <p className="text-xs text-muted-foreground italic p-2">{t("presets.noPluginsFound")}</p>}
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
                    <Label htmlFor="include-mcps" className="cursor-pointer font-medium text-sm">{t("presets.mcps")}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectedMcps.length}/{config?.mcp ? Object.keys(mcpServers(config)).length : 0}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          const allLocks = config?.mcp ? Object.keys(mcpServers(config)) : [];
                          if (selectedMcps.length === allLocks.length) setSelectedMcps([]);
                          else setSelectedMcps(allLocks);
                        }}
                      >
                        {selectedMcps.length === (config?.mcp ? Object.keys(mcpServers(config)).length : 0) ? t("presets.none") : t("presets.all")}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[65vh] p-2 space-y-1">
                    {!config?.mcp || Object.keys(mcpServers(config)).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-2">{t("presets.noMcpServersFound")}</p>
                    ) : (
                      Object.keys(mcpServers(config)).map(key => (
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
            <Button onClick={handleCreate}>{t("presets.savePreset")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("presets.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("presets.deleteConfirm", { name: deleteTarget?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
