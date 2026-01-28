"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/context";
import api, { getPaths, setConfigPath, getBackup, restoreBackup, getOhMyConfig, saveOhMyConfig, getGitHubBackupStatus, backupToGitHub, restoreFromGitHub, setGitHubAutoSync, type PathsInfo, type BackupData } from "@/lib/api";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionEditor } from "@/components/permission-editor";
import { Sliders as Settings, Android, Download, Upload, Save, ChevronDown, Loader, Code, Github, InfoBox, Android as Bot } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import type { OpencodeConfig, OhMyPreferences, OhMyAgentPreferences, GitHubBackupStatus } from "@/types";

const THEMES = ["dark", "light", "auto"] as const;
const SHARE_OPTIONS = ["manual", "auto", "disabled"] as const;

const OHMY_AGENTS = [
  { id: "Sisyphus", name: "Sisyphus", desc: "Main coding agent - handles implementation, debugging, and code changes" },
  { id: "oracle", name: "Oracle", desc: "Senior advisor for architecture decisions, code review, and complex reasoning" },
  { id: "librarian", name: "Librarian", desc: "Documentation lookup, external code search, and library research" },
  { id: "explore", name: "Explore", desc: "Codebase navigation, file discovery, and pattern searching" },
  { id: "frontend-ui-ux-engineer", name: "Frontend UI/UX", desc: "Visual design, styling, and UI component implementation" },
  { id: "document-writer", name: "Document Writer", desc: "README files, API docs, and technical documentation" },
  { id: "multimodal-looker", name: "Multimodal Looker", desc: "Image/PDF analysis and visual content interpretation" },
] as const;

const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;

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
  const [pathsInfoBox, setPathsInfo] = useState<PathsInfo | null>(null);
  const [manualPath, setManualPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    permissions: false,
    prompts: false,
    backup: false,
    ohmy: false,
  });
  
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
  const [restoring, setRestoring] = useState(false);


  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

useEffect(() => {
    getPaths().then(setPathsInfo).catch(console.error);
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

  const handleGitHubRestore = async () => {
    if (!ghOwner || !ghRepo) {
      toast.error("Owner and repo required");
      return;
    }
    setRestoring(true);
    try {
      const result = await restoreFromGitHub({ owner: ghOwner, repo: ghRepo, branch: ghBranch });
      if (result.success) {
        toast.success(result.message);
        await refreshData();
      } else {
        toast.error("Restore failed");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setRestoring(false);
    }
  };

  const handleToggleGitHubAutoSync = async (enabled: boolean) => {
    try {
      await setGitHubAutoSync(enabled);
      const status = await getGitHubBackupStatus();
      setGhBackupStatus(status);
      toast.success(enabled ? "Auto-sync enabled" : "Auto-sync disabled");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <PageHelp title="Settings" docUrl="https://opencode.ai/docs/settings" docTitle="Settings" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHelp title="Settings" docUrl="https://opencode.ai/docs/settings" docTitle="Settings" />

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
                  <Settings className="h-5 w-5" />
                  <CardTitle>Permissions</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${openSections.permissions ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Manage tool permissions and patterns</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent className="animate-scale-in">
            <CardContent className="space-y-4 pt-0">
              <PermissionEditor
                value={config?.permission || {}}
                onChange={(next) => updateConfig({ permission: next })}
              />
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
                  <Code className="h-5 w-5" />
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
                    <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
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
                  {savingPrompt && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
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

              {/* GitHub Sync */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <Github className="h-8 w-8 text-primary" />
                  <div>
                    <Label className="text-base">GitHub Sync</Label>
                    <p className="text-sm text-muted-foreground">
                      Sync config to a private GitHub repository
                    </p>
                  </div>
                </div>
                
                {ghBackupStatus?.connected ? (
                  <>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm">Connected as {ghBackupStatus.user}</span>
                      </div>
                      {ghBackupStatus.lastUpdated && (
                        <p className="text-xs text-muted-foreground">
                          Last sync: {new Date(ghBackupStatus.lastUpdated).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Owner</Label>
                        <Input value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} placeholder="username" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Repository</Label>
                        <Input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} placeholder="opencode-backup" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Branch</Label>
                        <Input value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} placeholder="main" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-4">
                      <div>
                        <Label>Auto-Sync</Label>
                        <p className="text-xs text-muted-foreground">Sync on startup</p>
                      </div>
                      <Switch
                        checked={ghBackupStatus.autoSync || false}
                        onCheckedChange={handleToggleGitHubAutoSync}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={handleGitHubBackup} disabled={backingUp || restoring}>
                        {backingUp ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {backingUp ? "Pushing..." : "Push to GitHub"}
                      </Button>
                      <Button variant="outline" onClick={handleGitHubRestore} disabled={backingUp || restoring}>
                        {restoring ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {restoring ? "Pulling..." : "Pull from GitHub"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      GitHub CLI not authenticated. Run <code className="bg-muted px-1 rounded">gh auth login</code> first.
                    </p>
                    {ghBackupStatus?.error && (
                      <p className="text-sm text-destructive mt-2">{ghBackupStatus.error}</p>
                    )}
                  </div>
                )}
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <Label className="text-[10px] text-muted-foreground">Thinking</Label>
                                    <InfoBox className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs">Extended thinking for Gemini models. Enables multi-step reasoning before responding.</p>
                                </TooltipContent>
                              </Tooltip>
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <Label className="text-[10px] text-muted-foreground">Reasoning</Label>
                                    <InfoBox className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs">Reasoning effort for OpenAI o-series models. Higher = more tokens spent on chain-of-thought before answering.</p>
                                </TooltipContent>
                              </Tooltip>
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
                  {savingOhMy && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Save Model Preferences
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>


    </div>
  );
}
