"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/context";
import { getPaths, setConfigPath, getBackup, restoreBackup, getAuthDebug, getSyncStatus, setSyncConfig, syncPush, syncPull, getDropboxAuthUrl, dropboxCallback, getGoogleDriveAuthUrl, googleDriveCallback, disconnectSync, getCooldownRules, addCooldownRule, deleteCooldownRule, type PathsInfo, type BackupData, type AuthDebugInfo, type SyncStatus, type CooldownRule } from "@/lib/api";
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
  Cloud,
  CloudUpload,
  CloudDownload,
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
    cooldowns: false,
    sync: false,
    backup: false,
  });

  const [cooldownRules, setCooldownRules] = useState<CooldownRule[]>([]);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDuration, setNewRuleDuration] = useState("");

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    getPaths().then(setPathsInfo).catch(console.error);
    getAuthDebug().then(setAuthDebug).catch(console.error);
    getSyncStatus().then(setSyncStatus).catch(console.error);
    getCooldownRules().then(setCooldownRules).catch(console.error);
    
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      // Try both providers since we don't know which one it is just from params
      // But we can check if it looks like google (often long) vs dropbox
      // Actually, we can just try one then the other, or look at session storage if we persisted it
      // For now, let's try dropbox first, if fails try google
      
      dropboxCallback(code, state).then(async () => {
        const status = await getSyncStatus();
        setSyncStatus(status);
        toast.success('Dropbox connected successfully');
        window.history.replaceState({}, '', window.location.pathname);
      }).catch(err => {
        // If dropbox fails, try google
        googleDriveCallback(code, state).then(async () => {
          const status = await getSyncStatus();
          setSyncStatus(status);
          toast.success('Google Drive connected successfully');
          window.history.replaceState({}, '', window.location.pathname);
        }).catch(err2 => {
          toast.error('Failed to connect cloud provider');
          window.history.replaceState({}, '', window.location.pathname);
        });
      });
    }
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

  const handleConnectDropbox = async () => {
    setConnectingProvider('dropbox');
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const { url } = await getDropboxAuthUrl(redirectUri);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      setConnectingProvider(null);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectingProvider('gdrive');
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const { url } = await getGoogleDriveAuthUrl(redirectUri);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      setConnectingProvider(null);
    }
  };

  const handleDisconnectSync = async () => {
    try {
      await disconnectSync();
      const status = await getSyncStatus();
      setSyncStatus(status);
      toast.success('Cloud sync disconnected');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      const config = { autoSync: enabled };
      await setSyncConfig(config);
      const status = await getSyncStatus();
      setSyncStatus(status);
      toast.success(enabled ? "Auto-sync enabled" : "Auto-sync disabled");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleAddCooldownRule = async () => {
    if (!newRuleName || !newRuleDuration) return;
    const duration = parseFloat(newRuleDuration) * 3600000; // hours to ms
    try {
      const rules = await addCooldownRule(newRuleName, duration);
      setCooldownRules(rules);
      setNewRuleName("");
      setNewRuleDuration("");
      toast.success("Rule added");
    } catch (e) {
      toast.error("Failed to add rule");
    }
  };

  const handleDeleteCooldownRule = async (name: string) => {
    try {
      const rules = await deleteCooldownRule(name);
      setCooldownRules(rules);
      toast.success("Rule deleted");
    } catch (e) {
      toast.error("Failed to delete rule");
    }
  };

  const handleSyncPush = async () => {
    setSyncing(true);
    try {
      const result = await syncPush();
      const status = await getSyncStatus();
      setSyncStatus(status);
      toast.success(`Config pushed to sync folder`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncPull = async () => {
    setSyncing(true);
    try {
      const result = await syncPull();
      const status = await getSyncStatus();
      setSyncStatus(status);
      await refreshData();
      toast.success(`Config pulled: ${result.skills} skills, ${result.plugins} plugins`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setSyncing(false);
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

      <Collapsible open={openSections.cooldowns} onOpenChange={() => toggleSection("cooldowns")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <CardTitle>Cooldown Configurations</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.cooldowns ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Configure cooldown durations for different models/plugins</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              <div className="space-y-4">
                {cooldownRules.map((rule) => (
                  <div key={rule.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-sm text-muted-foreground">{rule.duration / 3600000} hours</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCooldownRule(rule.name)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      Delete
                    </Button>
                  </div>
                ))}
                
                <div className="grid grid-cols-[1fr,100px,auto] gap-2 pt-2 border-t">
                  <Input 
                    placeholder="Rule Name (e.g. Opus 4.5)" 
                    value={newRuleName} 
                    onChange={(e) => setNewRuleName(e.target.value)} 
                  />
                  <Input 
                    placeholder="Hours" 
                    type="number"
                    value={newRuleDuration} 
                    onChange={(e) => setNewRuleDuration(e.target.value)} 
                  />
                  <Button onClick={handleAddCooldownRule} disabled={!newRuleName || !newRuleDuration}>
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.sync} onOpenChange={() => toggleSection("sync")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  <CardTitle>Cloud Sync</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.sync ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Sync config across devices via Dropbox or Google Drive</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              {syncStatus?.connected ? (
                <>
                  <div className="p-4 bg-background rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="font-medium capitalize">{syncStatus.provider}</span>
                        <span className="text-muted-foreground text-sm">connected</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleDisconnectSync}>
                        Disconnect
                      </Button>
                    </div>
                    {syncStatus.lastSync && (
                      <p className="text-xs text-muted-foreground">
                        Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button onClick={handleSyncPush} disabled={syncing} className="w-full">
                      <CloudUpload className="h-4 w-4 mr-2" />
                      {syncing ? "Syncing..." : "Push to Cloud"}
                    </Button>
                    <Button onClick={handleSyncPull} disabled={syncing} variant="outline" className="w-full">
                      <CloudDownload className="h-4 w-4 mr-2" />
                      {syncing ? "Syncing..." : "Pull from Cloud"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                    <div>
                      <Label className="text-base">Auto-Sync</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically sync on startup and after config changes
                      </p>
                    </div>
                    <Switch
                      checked={syncStatus.autoSync}
                      onCheckedChange={handleToggleAutoSync}
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 bg-background rounded-lg space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect a cloud service to sync your config across devices.
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleConnectDropbox} 
                      disabled={connectingProvider === 'dropbox'}
                      className="flex-1"
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4zM6 14l6 4 6-4-6-4z"/>
                      </svg>
                      {connectingProvider === 'dropbox' ? 'Connecting...' : 'Connect Dropbox'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleConnectGoogle}
                      disabled={connectingProvider === 'gdrive'}
                      className="flex-1"
                    >
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {connectingProvider === 'gdrive' ? 'Connecting...' : 'Connect Google Drive'}
                    </Button>
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
