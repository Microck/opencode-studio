"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/context";
import api, { getPaths, setConfigPath, getBackup, restoreBackup, getAuthDebug, getSyncStatus, setSyncConfig, syncPush, syncPull, getDropboxAuthUrl, dropboxCallback, disconnectSync, getCooldownRules, addCooldownRule, deleteCooldownRule, getOhMyConfig, saveOhMyConfig, getGitHubBackupStatus, backupToGitHub, type PathsInfo, type BackupData, type AuthDebugInfo, type SyncStatus, type CooldownRule } from "@/lib/api";
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
  Loader2,
  FileCode,
  Github,
} from "lucide-react";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import type { PermissionValue, OpencodeConfig, OhMyPreferences, OhMyAgentPreferences, GitHubBackupStatus } from "@/types";

const THEMES = ["dark", "light", "auto"] as const;
const SHARE_OPTIONS = ["manual", "auto", "disabled"] as const;
const PERMISSION_VALUES: PermissionValue[] = ["ask", "allow", "deny"];

const OHMY_AGENTS = [
  { id: "Sisyphus", name: "Sisyphus", desc: "Main coding agent - handles implementation, debugging, and code changes" },
  { id: "oracle", name: "Oracle", desc: "Senior advisor for architecture decisions, code review, and complex reasoning" },
  { id: "librarian", name: "Librarian", desc: "Documentation lookup, external code search, and library research" },
  { id: "explore", name: "Explore", desc: "Codebase navigation, file discovery, and pattern searching" },
  { id: "frontend-ui-ux-engineer", name: "Frontend UI/UX", desc: "Visual design, styling, and UI component implementation" },
  { id: "document-writer", name: "Document Writer", desc: "README files, API docs, and technical documentation" },
  { id: "multimodal-looker", name: "Multimodal Looker", desc: "Image/PDF analysis and visual content interpretation" },
] as const;

const REASONING_EFFORTS = ["low", "medium", "high"] as const;

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
    prompts: false,
    cooldowns: false,
    sync: false,
    backup: false,
    ohmy: false,
    githubBackup: false,
  });

  const [cooldownRules, setCooldownRules] = useState<CooldownRule[]>([]);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDuration, setNewRuleDuration] = useState("");

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  
const [systemPrompt, setSystemPrompt] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const { theme } = useTheme();

  const [ohMyPrefs, setOhMyPrefs] = useState<OhMyPreferences>({ agents: {} });
  const [savingOhMy, setSavingOhMy] = useState(false);

  const [ghBackupStatus, setGhBackupStatus] = useState<GitHubBackupStatus | null>(null);
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("opencode-backup");
  const [ghBranch, setGhBranch] = useState("main");
  const [backingUp, setBackingUp] = useState(false);


  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

useEffect(() => {
    getPaths().then(setPathsInfo).catch(console.error);
    getAuthDebug().then(setAuthDebug).catch(console.error);
    getSyncStatus().then(setSyncStatus).catch(console.error);
    getCooldownRules().then(setCooldownRules).catch(console.error);
    loadSystemPrompt();
    
    getOhMyConfig().then(res => {
      setOhMyPrefs(res.preferences);
    }).catch(console.error);
    
    getGitHubBackupStatus().then(status => {
      setGhBackupStatus(status);
      if (status.config) {
        if (status.config.owner) setGhOwner(status.config.owner);
        if (status.config.repo) setGhRepo(status.config.repo);
        if (status.config.branch) setGhBranch(status.config.branch);
      }
      if (status.user && !status.config?.owner) setGhOwner(status.user);
    }).catch(console.error);
    
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      dropboxCallback(code, state).then(async () => {
        const status = await getSyncStatus();
        setSyncStatus(status);
        toast.success('Dropbox connected successfully');
        window.history.replaceState({}, '', window.location.pathname);
      }).catch(() => {
        toast.error('Failed to connect Dropbox');
        window.history.replaceState({}, '', window.location.pathname);
      });
    }
  }, []);

  const loadSystemPrompt = async () => {
    try {
      setLoadingPrompt(true);
      const res = await api.get('/prompts/global');
      setSystemPrompt(res.data.content);
    } catch (error) {
      console.error("Error loading prompt:", error);
    } finally {
      setLoadingPrompt(false);
    }
  };

  const handleSaveSystemPrompt = async () => {
    try {
      setSavingPrompt(true);
      await api.post('/prompts/global', { content: systemPrompt });
      toast.success("System prompt updated");
    } catch (error) {
      toast.error("Failed to save system prompt");
    } finally {
      setSavingPrompt(false);
    }
  };

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

const updateOhMyAgent = (agent: string, index: number, field: 'model' | 'available', value: string | boolean) => {
    setOhMyPrefs(prev => {
      const agents = { ...prev.agents };
      if (!agents[agent]) {
        agents[agent] = { choices: [{ model: '', available: true }, { model: '', available: true }, { model: '', available: true }] };
      }
      const choices = [...agents[agent].choices];
      while (choices.length < 3) choices.push({ model: '', available: true });
      choices[index] = { ...choices[index], [field]: value };
      agents[agent] = { ...agents[agent], choices };
      return { agents };
});
  };

  const updateOhMyModelConfig = (agent: string, index: number, field: 'thinking' | 'reasoning', value: { type: 'enabled' | 'disabled' } | { effort: 'low' | 'medium' | 'high' | 'xhigh' } | undefined) => {
    setOhMyPrefs(prev => {
      const agents = { ...prev.agents };
      if (!agents[agent]) {
        agents[agent] = { choices: [{ model: '', available: true }, { model: '', available: true }, { model: '', available: true }] };
      }
      const choices = [...agents[agent].choices];
      while (choices.length < 3) choices.push({ model: '', available: true });
      const updated = { ...choices[index] };
      if (value === undefined) {
        delete (updated as Record<string, unknown>)[field];
      } else {
        (updated as Record<string, unknown>)[field] = value;
      }
      choices[index] = updated;
      agents[agent] = { choices };
      return { agents };
    });
  };

  const handleSaveOhMy = async () => {
    setSavingOhMy(true);
    try {
      const result = await saveOhMyConfig(ohMyPrefs);
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((w: string) => toast.warning(w));
      } else {
        toast.success("Oh My OpenCode config saved");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setSavingOhMy(false);
    }
  };

  const handleGitHubBackup = async () => {
    if (!ghOwner || !ghRepo) {
      toast.error("Owner and repo required");
      return;
    }
    setBackingUp(true);
    try {
      const result = await backupToGitHub({ owner: ghOwner, repo: ghRepo, branch: ghBranch });
      if (result.success) {
        toast.success(`Backup complete: ${result.url}`);
        const status = await getGitHubBackupStatus();
        setGhBackupStatus(status);
      } else {
        toast.error(result.error || "Backup failed");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setBackingUp(false);
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
 
      <Collapsible open={openSections.prompts} onOpenChange={() => toggleSection("prompts")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  <CardTitle>System Prompt</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.prompts ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Edit your global OPENCODE.md instructions</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-4 pt-0">
              <div className="border rounded-md overflow-hidden h-[400px]">
                {loadingPrompt ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    defaultLanguage="markdown"
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    value={systemPrompt}
                    onChange={(val) => setSystemPrompt(val || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                    }}
                  />
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSystemPrompt} disabled={savingPrompt}>
                  {savingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
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

<Collapsible open={openSections.ohmy} onOpenChange={() => toggleSection("ohmy")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  <CardTitle>Oh My OpenCode Models</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.ohmy ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Configure model fallback preferences per agent</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              {OHMY_AGENTS.map(({ id, name, desc }) => {
                const agentPrefs = ohMyPrefs.agents[id] || { choices: [] };
                const choices = [...agentPrefs.choices];
                while (choices.length < 3) choices.push({ model: '', available: true });
                return (
                  <div key={id} className="p-4 bg-background rounded-lg space-y-4">
                    <div>
                      <Label className="text-base font-semibold">{name}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Model Fallbacks</Label>
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="space-y-2 p-3 bg-muted/30 rounded-md">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                            <Input
                              placeholder={`Model ${i + 1} (e.g. google/gemini-3-pro)`}
                              value={choices[i]?.model || ''}
                              onChange={(e) => updateOhMyAgent(id, i, 'model', e.target.value)}
                              className="flex-1"
                            />
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={choices[i]?.available ?? true}
                                onCheckedChange={(v) => updateOhMyAgent(id, i, 'available', v)}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4 ml-7">
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] text-muted-foreground">Thinking</Label>
                              <Select
                                value={choices[i]?.thinking?.type || 'disabled'}
                                onValueChange={(v) => updateOhMyModelConfig(id, i, 'thinking', v === 'disabled' ? undefined : { type: v as 'enabled' | 'disabled' })}
                              >
                                <SelectTrigger className="h-7 w-24 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="disabled">Off</SelectItem>
                                  <SelectItem value="enabled">On</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] text-muted-foreground">Reasoning</Label>
                              <Select
                                value={choices[i]?.reasoning?.effort || 'disabled'}
                                onValueChange={(v) => updateOhMyModelConfig(id, i, 'reasoning', v === 'disabled' ? undefined : { effort: v as 'low' | 'medium' | 'high' | 'xhigh' })}
                              >
                                <SelectTrigger className="h-7 w-24 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="disabled">Off</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="xhigh">XHigh</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end">
                <Button onClick={handleSaveOhMy} disabled={savingOhMy}>
                  {savingOhMy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Model Preferences
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSections.githubBackup} onOpenChange={() => toggleSection("githubBackup")}>
        <Card className="hover-lift">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  <CardTitle>GitHub Backup</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.githubBackup ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Backup config to a private GitHub repository</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-6 pt-0">
              {ghBackupStatus?.connected ? (
                <>
                  <div className="p-4 bg-background rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-medium">GitHub CLI authenticated</span>
                      <span className="text-muted-foreground text-sm">as {ghBackupStatus.user}</span>
                    </div>
                    {ghBackupStatus.lastUpdated && (
                      <p className="text-xs text-muted-foreground">
                        Last backup: {new Date(ghBackupStatus.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Owner</Label>
                      <Input value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} placeholder="username" />
                    </div>
                    <div className="space-y-2">
                      <Label>Repository</Label>
                      <Input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} placeholder="opencode-backup" />
                    </div>
                    <div className="space-y-2">
                      <Label>Branch</Label>
                      <Input value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} placeholder="main" />
                    </div>
                  </div>

                  <Button onClick={handleGitHubBackup} disabled={backingUp} className="w-full">
                    {backingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
                    {backingUp ? "Backing up..." : "Backup to GitHub"}
                  </Button>
                </>
              ) : (
                <div className="p-4 bg-background rounded-lg space-y-3">
                  <p className="text-sm text-muted-foreground">
                    GitHub CLI not authenticated. Run <code className="bg-muted px-1 rounded">gh auth login</code> first.
                  </p>
                  {ghBackupStatus?.error && (
                    <p className="text-sm text-destructive">{ghBackupStatus.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
