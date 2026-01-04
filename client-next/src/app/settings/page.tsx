"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/context";
import { getPaths, setConfigPath, getBackup, restoreBackup, type PathsInfo, type BackupData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Shield,
  Bot,
  Keyboard,
  Monitor,
  FolderCog,
  RotateCcw,
  Download,
  Upload,
  Save,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { PermissionValue, OpencodeConfig } from "@/types";

const THEMES = ["dark", "light", "auto"] as const;
const SHARE_OPTIONS = ["manual", "auto", "disabled"] as const;
const PERMISSION_VALUES: PermissionValue[] = ["ask", "allow", "deny"];
const AGENT_NAMES = ["plan", "build", "general", "explore", "title", "summary", "compaction"] as const;

const ESSENTIAL_KEYBINDS = [
  ["leader", "Leader key"],
  ["app_exit", "Exit app"],
  ["session_new", "New session"],
  ["session_list", "List sessions"],
  ["session_interrupt", "Interrupt"],
  ["input_submit", "Submit input"],
  ["input_clear", "Clear input"],
  ["input_newline", "New line"],
  ["model_list", "Model selector"],
  ["agent_cycle", "Cycle agent"],
  ["messages_undo", "Undo"],
  ["messages_redo", "Redo"],
] as const;

export default function SettingsPage() {
  const { config, loading, saveConfig, refreshData } = useApp();
  const [pathsInfo, setPathsInfo] = useState<PathsInfo | null>(null);
  const [manualPath, setManualPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    permissions: false,
    agents: false,
    keybinds: false,
    tui: false,
    path: false,
    backup: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    getPaths().then(setPathsInfo).catch(console.error);
  }, []);

  const updateConfig = async (updates: Partial<OpencodeConfig>) => {
    if (!config) return;
    try {
      await saveConfig({ ...config, ...updates });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleSetPath = async () => {
    try {
      await setConfigPath(manualPath || null);
      const newPaths = await getPaths();
      setPathsInfo(newPaths);
      await refreshData();
      toast.success(manualPath ? "Config path updated" : "Reset to auto-detect");
      setManualPath("");
    } catch {
      toast.error("Failed to set config path");
    }
  };

  const handleResetPath = async () => {
    try {
      await setConfigPath(null);
      const newPaths = await getPaths();
      setPathsInfo(newPaths);
      await refreshData();
      toast.success("Reset to auto-detect");
    } catch {
      toast.error("Failed to reset path");
    }
  };

  const handleBackup = async () => {
    try {
      const backup = await getBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `opencode-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch {
      toast.error("Failed to create backup");
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const backup = JSON.parse(content) as BackupData;
      
      if (!backup.version || backup.version !== 1) {
        toast.error("Invalid backup file format");
        return;
      }

      await restoreBackup(backup);
      await refreshData();
      toast.success("Backup restored successfully");
    } catch {
      toast.error("Failed to restore backup");
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getPermissionValue = (key: keyof NonNullable<OpencodeConfig["permission"]>): PermissionValue => {
    const val = config?.permission?.[key];
    if (typeof val === "string") return val;
    return "ask";
  };

  const setPermission = (key: keyof NonNullable<OpencodeConfig["permission"]>, value: PermissionValue) => {
    updateConfig({
      permission: { ...config?.permission, [key]: value },
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Collapsible open={openSections.general} onOpenChange={() => toggleSection("general")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  <CardTitle>General Settings</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.general ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Configure core OpenCode behavior</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={config?.theme || "dark"}
                    onValueChange={(v) => updateConfig({ theme: v as typeof THEMES[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEMES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Share Mode</Label>
                  <Select
                    value={config?.share || "manual"}
                    onValueChange={(v) => updateConfig({ share: v as typeof SHARE_OPTIONS[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHARE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Agent</Label>
                  <Input
                    value={config?.default_agent || ""}
                    onChange={(e) => updateConfig({ default_agent: e.target.value || undefined })}
                    placeholder="e.g., build"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={config?.username || ""}
                    onChange={(e) => updateConfig({ username: e.target.value || undefined })}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Small Model</Label>
                  <Input
                    value={config?.small_model || ""}
                    onChange={(e) => updateConfig({ small_model: e.target.value || undefined })}
                    placeholder="e.g., gpt-4o-mini"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                <div>
                  <Label>Auto Update</Label>
                  <p className="text-sm text-muted-foreground">Automatically update OpenCode</p>
                </div>
                <Switch
                  checked={config?.autoupdate === true}
                  onCheckedChange={(v) => updateConfig({ autoupdate: v })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                <div>
                  <Label>Snapshot</Label>
                  <p className="text-sm text-muted-foreground">Enable conversation snapshots</p>
                </div>
                <Switch
                  checked={config?.snapshot === true}
                  onCheckedChange={(v) => updateConfig({ snapshot: v })}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.permissions} onOpenChange={() => toggleSection("permissions")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <CardTitle>Permissions</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.permissions ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Control what actions OpenCode can perform</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-4 pt-0">
              {(["edit", "bash", "skill", "webfetch", "doom_loop", "external_directory"] as const).map((perm) => (
                <div key={perm} className="flex items-center justify-between p-4 bg-background rounded-lg">
                  <div>
                    <Label className="capitalize">{perm.replace("_", " ")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {perm === "edit" && "Allow editing files"}
                      {perm === "bash" && "Allow running shell commands"}
                      {perm === "skill" && "Allow using skills"}
                      {perm === "webfetch" && "Allow fetching web content"}
                      {perm === "doom_loop" && "Allow repeated automated actions"}
                      {perm === "external_directory" && "Allow accessing external directories"}
                    </p>
                  </div>
                  <Select value={getPermissionValue(perm)} onValueChange={(v) => setPermission(perm, v as PermissionValue)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMISSION_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.agents} onOpenChange={() => toggleSection("agents")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  <CardTitle>Agents</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.agents ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Configure individual agent behavior</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-4 pt-0">
              {AGENT_NAMES.map((agent) => (
                <div key={agent} className="p-4 bg-background rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium capitalize">{agent}</Label>
                    <Switch
                      checked={!config?.agents?.[agent]?.disable}
                      onCheckedChange={(v) => updateConfig({
                        agents: {
                          ...config?.agents,
                          [agent]: { ...config?.agents?.[agent], disable: !v },
                        },
                      })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Model</Label>
                      <Input
                        value={config?.agents?.[agent]?.model || ""}
                        onChange={(e) => updateConfig({
                          agents: {
                            ...config?.agents,
                            [agent]: { ...config?.agents?.[agent], model: e.target.value || undefined },
                          },
                        })}
                        placeholder="Default"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Temperature</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={config?.agents?.[agent]?.temperature ?? ""}
                        onChange={(e) => updateConfig({
                          agents: {
                            ...config?.agents,
                            [agent]: { ...config?.agents?.[agent], temperature: e.target.value ? parseFloat(e.target.value) : undefined },
                          },
                        })}
                        placeholder="0.7"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Color</Label>
                      <Input
                        type="color"
                        value={config?.agents?.[agent]?.color || "#888888"}
                        onChange={(e) => updateConfig({
                          agents: {
                            ...config?.agents,
                            [agent]: { ...config?.agents?.[agent], color: e.target.value },
                          },
                        })}
                        className="h-9 p-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.keybinds} onOpenChange={() => toggleSection("keybinds")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  <CardTitle>Keybinds</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.keybinds ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Customize keyboard shortcuts</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                {ESSENTIAL_KEYBINDS.map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-background rounded-lg">
                    <Label className="text-sm">{label}</Label>
                    <Input
                      value={config?.keybinds?.[key] || ""}
                      onChange={(e) => updateConfig({
                        keybinds: { ...config?.keybinds, [key]: e.target.value || undefined },
                      })}
                      placeholder="ctrl+x"
                      className="w-32 text-center font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.tui} onOpenChange={() => toggleSection("tui")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  <CardTitle>TUI Settings</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.tui ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Terminal user interface options</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Scroll Speed</Label>
                  <Input
                    type="number"
                    value={config?.tui?.scroll_speed ?? ""}
                    onChange={(e) => updateConfig({
                      tui: { ...config?.tui, scroll_speed: e.target.value ? parseInt(e.target.value) : undefined },
                    })}
                    placeholder="3"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Diff Style</Label>
                  <Select
                    value={config?.tui?.diff_style || "auto"}
                    onValueChange={(v) => updateConfig({
                      tui: { ...config?.tui, diff_style: v as "auto" | "stacked" | "inline" },
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">auto</SelectItem>
                      <SelectItem value="stacked">stacked</SelectItem>
                      <SelectItem value="inline">inline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                <div>
                  <Label>Scroll Acceleration</Label>
                  <p className="text-sm text-muted-foreground">Enable smooth scroll acceleration</p>
                </div>
                <Switch
                  checked={config?.tui?.scroll_acceleration?.enabled ?? false}
                  onCheckedChange={(v) => updateConfig({
                    tui: {
                      ...config?.tui,
                      scroll_acceleration: { ...config?.tui?.scroll_acceleration, enabled: v },
                    },
                  })}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.path} onOpenChange={() => toggleSection("path")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderCog className="h-5 w-5" />
                  <CardTitle>Config Path</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.path ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Manage OpenCode configuration location</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              <div className="space-y-4">
                <div className="p-4 bg-background rounded-lg space-y-2">
                  <Label className="text-xs text-muted-foreground">Current Path</Label>
                  <p className="font-mono text-sm break-all">{pathsInfo?.current || "Not found"}</p>
                </div>

                {pathsInfo?.manual && (
                  <div className="p-4 bg-background rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Manual Override</Label>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-sm break-all">{pathsInfo.manual}</p>
                      <Button variant="ghost" size="sm" onClick={handleResetPath}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                  </div>
                )}

                {pathsInfo?.detected && pathsInfo.detected !== pathsInfo.current && (
                  <div className="p-4 bg-background rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Auto-Detected</Label>
                    <p className="font-mono text-sm break-all">{pathsInfo.detected}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Set Custom Path</Label>
                <div className="flex gap-2">
                  <Input
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    placeholder="C:\Users\...\.config\opencode"
                    className="flex-1"
                  />
                  <Button onClick={handleSetPath} disabled={!manualPath}>
                    Set Path
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Directory must contain opencode.json
                </p>
              </div>

              {pathsInfo?.candidates && pathsInfo.candidates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Search Locations</Label>
                  <div className="space-y-1">
                    {pathsInfo.candidates.map((p, i) => (
                      <p key={i} className="font-mono text-xs text-muted-foreground break-all">{p}</p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.backup} onOpenChange={() => toggleSection("backup")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Save className="h-5 w-5" />
                  <CardTitle>Backup & Restore</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.backup ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Export or import your complete OpenCode configuration</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              <div className="p-6 bg-background rounded-lg space-y-4">
                <div className="flex items-center gap-4">
                  <Download className="h-8 w-8 text-primary" />
                  <div>
                    <Label className="text-base">Export Backup</Label>
                    <p className="text-sm text-muted-foreground">
                      Download all settings, MCP configs, skills, and plugins
                    </p>
                  </div>
                </div>
                <Button onClick={handleBackup} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Backup
                </Button>
              </div>

              <div className="p-6 bg-background rounded-lg space-y-4">
                <div className="flex items-center gap-4">
                  <Upload className="h-8 w-8 text-primary" />
                  <div>
                    <Label className="text-base">Restore Backup</Label>
                    <p className="text-sm text-muted-foreground">
                      Import a previously exported backup file
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select Backup File
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Warning: This will overwrite your current configuration
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
