"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Editor } from "@monaco-editor/react";
import { toast } from "sonner";
import type { AgentConfig, AgentInfo, PermissionConfig } from "@/types";
import { getAgents, saveAgent, deleteAgent, toggleAgent } from "@/lib/api";
import { AgentCard } from "@/components/agent-card";
import { PermissionEditor } from "@/components/permission-editor";
import { PageHelp } from "@/components/page-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "@nsmr/pixelart-react";

const TOOL_OPTIONS = [
  "read",
  "edit",
  "bash",
  "glob",
  "grep",
  "list",
  "task",
  "skill",
  "lsp",
  "todoread",
  "todowrite",
  "webfetch",
];

const MODES: Array<AgentConfig["mode"]> = ["primary", "subagent", "all"];

interface AgentFormState {
  name: string;
  description: string;
  mode: AgentConfig["mode"];
  model: string;
  temperature: number;
  prompt: string;
  tools: Record<string, boolean>;
  permission: PermissionConfig;
  maxSteps?: number;
  disable?: boolean;
  hidden?: boolean;
  source: "markdown" | "json";
  scope: "global" | "project";
}

const emptyForm = (): AgentFormState => ({
  name: "",
  description: "",
  mode: "subagent",
  model: "",
  temperature: 0.3,
  prompt: "",
  tools: {},
  permission: { "*": "ask" },
  maxSteps: undefined,
  disable: false,
  hidden: false,
  source: "markdown",
  scope: "global",
});

export default function AgentsPage() {
  const { theme } = useTheme();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgentInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AgentFormState>(emptyForm());

  const filteredAgents = useMemo(() => agents, [agents]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await getAgents();
      setAgents(data);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to load agents";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const openEditor = (agent?: AgentInfo) => {
    if (!agent) {
      setEditing(null);
      setForm(emptyForm());
      setOpen(true);
      return;
    }

    setEditing(agent);
    setForm({
      name: agent.name,
      description: agent.description || "",
      mode: agent.mode || "subagent",
      model: agent.model || "",
      temperature: agent.temperature ?? 0.3,
      prompt: agent.prompt || "",
      tools: agent.tools || {},
      permission: agent.permission || agent.permissions || { "*": "ask" },
      maxSteps: agent.maxSteps,
      disable: agent.disable,
      hidden: agent.hidden,
      source: agent.source === "json" ? "json" : "markdown",
      scope: "global",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const payload: AgentConfig = {
      description: form.description || undefined,
      mode: form.mode || "subagent",
      model: form.model || undefined,
      temperature: form.temperature,
      prompt: form.prompt || "",
      tools: form.tools,
      permission: form.permission,
      maxSteps: form.maxSteps,
      disable: form.disable,
      hidden: form.hidden,
    };

    try {
      await saveAgent(editing?.name || form.name.trim(), payload, form.source, form.scope);
      toast.success(editing ? "Agent updated" : "Agent created");
      setOpen(false);
      setEditing(null);
      loadAgents();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to save agent";
      toast.error(msg);
    }
  };

  const handleDelete = async (agent: AgentInfo) => {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    try {
      await deleteAgent(agent.name);
      toast.success("Agent deleted");
      loadAgents();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete agent";
      toast.error(msg);
    }
  };

  const handleToggle = async (agent: AgentInfo) => {
    try {
      await toggleAgent(agent.name);
      loadAgents();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to toggle agent";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHelp title="Agents" docUrl="https://opencode.ai/docs/agents" docTitle="Agent Builder & Manager" />
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading agents...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={`${agent.source}-${agent.name}`}
              agent={agent}
              onEdit={() => openEditor(agent)}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Agent" : "New Agent"}</DialogTitle>
            <DialogDescription>Manage agent identity, prompt, tools, and permissions.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="agent-name"
                    disabled={!!editing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="What does this agent do?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={form.mode || "subagent"} onValueChange={(v) => setForm((prev) => ({ ...prev, mode: v as AgentConfig["mode"] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((mode) => (
                        <SelectItem key={mode} value={mode || "subagent"}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model Override</Label>
                  <Input
                    value={form.model}
                    onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                    placeholder="anthropic/claude-sonnet-4-20250514"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={form.temperature}
                    onChange={(e) => setForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Steps</Label>
                  <Input
                    type="number"
                    value={form.maxSteps ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxSteps: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                {!editing && (
                  <>
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select value={form.source} onValueChange={(v) => setForm((prev) => ({ ...prev, source: v as AgentFormState["source"] }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="markdown">Markdown</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Scope</Label>
                      <Select value={form.scope} onValueChange={(v) => setForm((prev) => ({ ...prev, scope: v as AgentFormState["scope"] }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Global</SelectItem>
                          <SelectItem value="project">Project</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tools</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {TOOL_OPTIONS.map((tool) => (
                    <label key={tool} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!!form.tools[tool]}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, tools: { ...prev.tools, [tool]: checked } }))
                        }
                      />
                      <span className="font-mono text-xs text-muted-foreground">{tool}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.disable} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, disable: checked }))} />
                  Disabled
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!form.hidden} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, hidden: checked }))} />
                  Hidden
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Editor
                  height="280px"
                  language="markdown"
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  value={form.prompt}
                  onChange={(value) => setForm((prev) => ({ ...prev, prompt: value || "" }))}
                  options={{ minimap: { enabled: false }, fontSize: 13 }}
                />
              </div>

              <PermissionEditor
                value={form.permission}
                onChange={(next) => setForm((prev) => ({ ...prev, permission: next }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
