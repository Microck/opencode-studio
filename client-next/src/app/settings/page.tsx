"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/context";
import { getPaths, setConfigPath, getBackup, restoreBackup, getAuthDebug, type PathsInfo, type BackupData, type AuthDebugInfo } from "@/lib/api";
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
  const [authDebug, setAuthDebug] = useState<AuthDebugInfo | null>(null);
  const [manualPath, setManualPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    permissions: false,
    agent: false,
    keybinds: false,
    tui: false,
    path: false,
    auth: false,
    backup: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    getPaths().then(setPathsInfo).catch(console.error);
    getAuthDebug().then(setAuthDebug).catch(console.error);
  }, []);

  const updateConfig = async (updates: Partial<OpencodeConfig>) => {
    if (!config) return;
    try {
      await saveConfig({ ...config, ...updates });
      toast.success("Settings saved");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to save settings: ${msg}`);
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
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to set config path: ${msg}`);
    }
  };

  const handleResetPath = async () => {
    try {
      await setConfigPath(null);
      const newPaths = await getPaths();
      setPathsInfo(newPaths);
      await refreshData();
      toast.success("Reset to auto-detect");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to reset path: ${msg}`);
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
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to create backup: ${msg}`);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const backup = JSON.parse(content) as BackupData;
      
      if (!backup.version || backup.version !== 1) {
        toast.error("Invalid backup file format (expected version 1)");
        return;
      }

      await restoreBackup(backup);
      await refreshData();
      toast.success("Backup restored successfully");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      toast.error(`Failed to restore backup: ${msg}`);
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
              {(["read", "edit", "glob", "grep", "list", "bash", "task", "skill", "lsp", "webfetch", "external_directory", "doom_loop"] as const).map((perm) => (
                <div key={perm} className="flex items-center justify-between p-4 bg-background rounded-lg">
                  <div>
                    <Label className="capitalize">{perm.replace("_", " ")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {perm === "read" && "Allow reading files"}
                      {perm === "edit" && "Allow editing files"}
                      {perm === "glob" && "Allow finding files with patterns"}
                      {perm === "grep" && "Allow searching file contents"}
                      {perm === "list" && "Allow listing directory contents"}
                      {perm === "bash" && "Allow running shell commands"}
                      {perm === "task" && "Allow creating sub-agent tasks"}
                      {perm === "skill" && "Allow using skills"}
                      {perm === "lsp" && "Allow LSP operations"}
                      {perm === "webfetch" && "Allow fetching web content"}
                      {perm === "external_directory" && "Allow accessing external directories"}
                      {perm === "doom_loop" && "Allow repeated automated actions"}
                    </p>
                  </div>
                  <Select value={getPermissionValue(perm as any)} onValueChange={(v) => setPermission(perm as any, v as PermissionValue)}>
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

      <Collapsible open={openSections.auth} onOpenChange={() => toggleSection("auth")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <CardTitle>Auth Debug</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.auth ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Debug authentication paths and profile locations</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-4 pt-0">
              {authDebug ? (
                <>
                  <div className="p-4 bg-background rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Active Google Plugin</Label>
                    <p className="font-mono text-sm">{authDebug.activeGooglePlugin || "none"}</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Active Profiles</Label>
                    <pre className="font-mono text-xs overflow-x-auto">{JSON.stringify(authDebug.activeProfiles, null, 2)}</pre>
                  </div>
                  <div className="p-4 bg-background rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Auth Locations</Label>
                    {authDebug.authLocations.map((loc, i) => (
                      <div key={i} className="text-xs font-mono">
                        <span className={loc.exists ? "text-green-500" : "text-red-500"}>{loc.exists ? "✓" : "✗"}</span>{" "}
                        <span className="break-all">{loc.path}</span>
                        {loc.exists && <span className="text-muted-foreground ml-2">[{loc.keys.join(", ")}]</span>}
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-background rounded-lg space-y-2">
                    <Label className="text-xs text-muted-foreground">Profile Directories</Label>
                    <p className="font-mono text-xs text-muted-foreground break-all mb-2">{authDebug.authProfilesDir}</p>
                    {Object.entries(authDebug.profileDirs).map(([ns, info]) => (
                      <div key={ns} className="text-xs font-mono">
                        <span className={info.exists ? "text-green-500" : "text-muted-foreground"}>{info.exists ? "✓" : "○"}</span>{" "}
                        <span>{ns}</span>
                        {info.exists && info.profiles.length > 0 && (
                          <span className="text-muted-foreground ml-2">[{info.profiles.join(", ")}]</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Loading...</p>
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
