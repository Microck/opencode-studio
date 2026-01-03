"use client";

import { useState } from "react";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import type { ProviderConfig } from "@/types";

interface ModelLimit {
  context?: number;
  output?: number;
}

interface ModelInfo {
  name?: string;
  attachments?: boolean;
  reasoning?: boolean;
  limit?: ModelLimit;
}

// Default context windows for common models (2025)
// Format: { context, output } - output is optional
const DEFAULT_MODEL_LIMITS: Record<string, { context: number; output?: number }> = {
  // OpenAI GPT-5 series (2025)
  "gpt-5": { context: 400000, output: 128000 },
  "gpt-5.1": { context: 400000, output: 128000 },
  "gpt-5.2": { context: 400000, output: 128000 },
  "gpt-5-mini": { context: 200000, output: 64000 },
  "gpt-5-nano": { context: 128000, output: 32000 },
  // OpenAI o-series (reasoning models)
  "o3": { context: 200000, output: 100000 },
  "o3-mini": { context: 200000, output: 65536 },
  "o3-pro": { context: 200000, output: 100000 },
  "o4-mini": { context: 200000, output: 100000 },
  "o1": { context: 200000, output: 100000 },
  "o1-mini": { context: 128000, output: 65536 },
  "o1-pro": { context: 200000, output: 100000 },
  // OpenAI GPT-4 series
  "gpt-4o": { context: 128000, output: 16384 },
  "gpt-4o-mini": { context: 128000, output: 16384 },
  "gpt-4-turbo": { context: 128000, output: 4096 },
  "gpt-4": { context: 8192, output: 8192 },
  "gpt-3.5-turbo": { context: 16385, output: 4096 },
  // Anthropic Claude 4.5 series
  "claude-opus-4.5": { context: 200000, output: 64000 },
  "claude-sonnet-4.5": { context: 200000, output: 64000 },
  "claude-haiku-4.5": { context: 200000, output: 64000 },
  // Anthropic Claude 4 series
  "claude-opus-4": { context: 200000, output: 32000 },
  "claude-sonnet-4": { context: 200000, output: 64000 },
  "claude-sonnet-4-1m": { context: 1000000, output: 64000 },
  // Anthropic Claude 3.x series
  "claude-3.5-sonnet": { context: 200000, output: 8192 },
  "claude-3.7-sonnet": { context: 200000, output: 64000 },
  "claude-3-opus": { context: 200000, output: 4096 },
  "claude-3-sonnet": { context: 200000, output: 4096 },
  "claude-3-haiku": { context: 200000, output: 4096 },
  // Google Gemini 3 series
  "gemini-3-pro": { context: 1000000, output: 65536 },
  "gemini-3-flash": { context: 1000000, output: 65536 },
  // Google Gemini 2.x series
  "gemini-2.5-pro": { context: 2097152, output: 65536 },
  "gemini-2.0-flash": { context: 1048576, output: 8192 },
  "gemini-1.5-pro": { context: 2097152, output: 8192 },
  "gemini-1.5-flash": { context: 1048576, output: 8192 },
  // DeepSeek
  "deepseek-v3": { context: 128000, output: 8192 },
  "deepseek-chat": { context: 64000, output: 4096 },
  "deepseek-coder": { context: 64000, output: 4096 },
  "deepseek-r1": { context: 128000, output: 8192 },
  // xAI Grok
  "grok-3": { context: 131072, output: 32768 },
  "grok-2": { context: 131072, output: 8192 },
  "grok-beta": { context: 131072, output: 8192 },
};

// Legacy compat - extract just context windows
const DEFAULT_CONTEXT_WINDOWS: Record<string, number> = Object.fromEntries(
  Object.entries(DEFAULT_MODEL_LIMITS).map(([k, v]) => [k, v.context])
);

function parseModelString(modelString: string): { provider: string; model: string } {
  if (modelString.includes("/")) {
    const [provider, ...rest] = modelString.split("/");
    return { provider, model: rest.join("/") };
  }
  return { provider: "default", model: modelString };
}

function formatTokens(n: number | undefined): string {
  if (!n) return "-";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

function getDefaultContext(modelId: string): number | undefined {
  const lower = modelId.toLowerCase();
  for (const [key, limits] of Object.entries(DEFAULT_MODEL_LIMITS)) {
    if (lower.includes(key.toLowerCase())) {
      return limits.context;
    }
  }
  return undefined;
}

interface ConfiguredModel {
  fullString: string;
  provider: string;
  modelId: string;
  config: ModelInfo;
}

export default function ModelsPage() {
  const { config, loading, saveConfig } = useApp();
  const [newModel, setNewModel] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newOutput, setNewOutput] = useState("");
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ context: "", output: "", attachments: false, reasoning: false });

  const getProviders = () => {
    if (typeof config?.model === 'object' && config.model !== null) {
      return config.model.providers || {};
    }
    return {};
  };

  const providers = getProviders();
  const currentModelString = typeof config?.model === "string" ? config.model : "";

  const getAllConfiguredModels = (): ConfiguredModel[] => {
    const result: ConfiguredModel[] = [];
    for (const [providerName, provider] of Object.entries(providers)) {
      if (provider.models) {
        for (const [modelId, modelConfig] of Object.entries(provider.models)) {
          result.push({
            fullString: `${providerName}/${modelId}`,
            provider: providerName,
            modelId,
            config: modelConfig as ModelInfo,
          });
        }
      }
    }
    return result;
  };

  const configuredModels = getAllConfiguredModels();

  const updateProviders = async (newProviders: Record<string, ProviderConfig>) => {
    if (!config) return;
    try {
      const modelConfig = typeof config.model === 'object' && config.model !== null ? config.model : {};
      await saveConfig({ 
        ...config, 
        model: {
          ...modelConfig,
          providers: newProviders
        }
      });
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleAddModel = async () => {
    if (!newModel.trim()) {
      toast.error("Enter a model (e.g., copilot/claude-opus-4.5)");
      return;
    }
    if (!newContext && !newOutput) {
      toast.error("Enter context window or output limit");
      return;
    }

    const { provider, model } = parseModelString(newModel.trim());
    const existingProvider = providers[provider] || {};
    const existingModel = (existingProvider.models?.[model] || {}) as ModelInfo;
    
    const modelConfig: ModelInfo = { ...existingModel };
    modelConfig.limit = { ...existingModel.limit };
    if (newContext) modelConfig.limit.context = parseInt(newContext);
    if (newOutput) modelConfig.limit.output = parseInt(newOutput);

    await updateProviders({
      ...providers,
      [provider]: {
        ...existingProvider,
        models: {
          ...existingProvider.models,
          [model]: modelConfig,
        },
      },
    });
    
    setNewModel("");
    setNewContext("");
    setNewOutput("");
  };

  const handleDeleteModel = async (provider: string, modelId: string) => {
    const providerConfig = providers[provider];
    if (!providerConfig?.models) return;
    
    const restModels = { ...providerConfig.models };
    delete restModels[modelId];
    
    if (Object.keys(restModels).length === 0) {
      const restProviders = { ...providers };
      delete restProviders[provider];
      await updateProviders(restProviders);
    } else {
      await updateProviders({
        ...providers,
        [provider]: { ...providerConfig, models: restModels },
      });
    }
  };

  const startEdit = (fullString: string, model: ConfiguredModel) => {
    setEditingModel(fullString);
    setEditForm({
      context: model.config.limit?.context?.toString() || "",
      output: model.config.limit?.output?.toString() || "",
      attachments: model.config.attachments || false,
      reasoning: model.config.reasoning || false,
    });
  };

  const cancelEdit = () => {
    setEditingModel(null);
  };

  const saveEdit = async (provider: string, modelId: string) => {
    const providerConfig = providers[provider] || {};
    const existingModel = (providerConfig.models?.[modelId] || {}) as ModelInfo;

    const modelConfig: ModelInfo = { ...existingModel };
    modelConfig.limit = {};
    if (editForm.context) modelConfig.limit.context = parseInt(editForm.context);
    if (editForm.output) modelConfig.limit.output = parseInt(editForm.output);
    if (editForm.attachments) modelConfig.attachments = true;
    else delete modelConfig.attachments;
    if (editForm.reasoning) modelConfig.reasoning = true;
    else delete modelConfig.reasoning;

    await updateProviders({
      ...providers,
      [provider]: {
        ...providerConfig,
        models: {
          ...providerConfig.models,
          [modelId]: modelConfig,
        },
      },
    });
    setEditingModel(null);
  };

  const isCurrentModel = (fullString: string) => fullString === currentModelString;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Models</h1>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Models</h1>
        <p className="text-muted-foreground">Configure context windows for any model</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Model Configuration
          </CardTitle>
          <CardDescription>
            Enter model as <code className="text-xs bg-background px-1.5 py-0.5 rounded">provider/model-name</code> (e.g., copilot/claude-opus-4.5, anthropic/claude-sonnet-4)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label className="text-xs text-muted-foreground">Model</Label>
              <Input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="copilot/claude-opus-4.5"
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
              />
            </div>
            <div className="w-36 space-y-2">
              <Label className="text-xs text-muted-foreground">Context Window</Label>
              <Input
                type="number"
                value={newContext}
                onChange={(e) => setNewContext(e.target.value)}
                placeholder={newModel ? formatTokens(getDefaultContext(newModel)) || "tokens" : "tokens"}
                onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
              />
            </div>
            <div className="w-32 space-y-2">
              <Label className="text-xs text-muted-foreground">Output Limit</Label>
              <Input
                type="number"
                value={newOutput}
                onChange={(e) => setNewOutput(e.target.value)}
                placeholder="optional"
                onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
              />
            </div>
            <Button onClick={handleAddModel}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Configured Models</CardTitle>
          <CardDescription>
            {configuredModels.length === 0 
              ? "No models configured yet. Add one above."
              : `${configuredModels.length} model${configuredModels.length !== 1 ? "s" : ""} configured`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configuredModels.length === 0 ? (
            <div className="py-8 text-center">
              <Cpu className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Add a model above to configure its context window.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Context Window</TableHead>
                  <TableHead className="text-right">Output Limit</TableHead>
                  <TableHead className="text-center">Features</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configuredModels.map((model) => {
                  const isEditing = editingModel === model.fullString;
                  const defaultCtx = getDefaultContext(model.modelId);
                  const isCurrent = isCurrentModel(model.fullString);

                  if (isEditing) {
                    return (
                      <TableRow key={model.fullString}>
                        <TableCell className="font-mono text-sm">
                          {model.fullString}
                          {isCurrent && <span className="ml-2 text-xs text-primary">(active)</span>}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={editForm.context}
                            onChange={(e) => setEditForm({ ...editForm, context: e.target.value })}
                            placeholder={defaultCtx ? formatTokens(defaultCtx) : "tokens"}
                            className="h-8 w-28 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={editForm.output}
                            onChange={(e) => setEditForm({ ...editForm, output: e.target.value })}
                            placeholder="optional"
                            className="h-8 w-24 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Switch
                                checked={editForm.attachments}
                                onCheckedChange={(v) => setEditForm({ ...editForm, attachments: v })}
                              />
                              Files
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Switch
                                checked={editForm.reasoning}
                                onCheckedChange={(v) => setEditForm({ ...editForm, reasoning: v })}
                              />
                              Reasoning
                            </label>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => saveEdit(model.provider, model.modelId)}>
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit}>
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow key={model.fullString}>
                      <TableCell className="font-mono text-sm">
                        {model.fullString}
                        {isCurrent && <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">active</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {model.config.limit?.context ? (
                          <span className="text-primary">{formatTokens(model.config.limit.context)}</span>
                        ) : (
                          <span className="text-muted-foreground">{formatTokens(defaultCtx)} (default)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {model.config.limit?.output ? formatTokens(model.config.limit.output) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {model.config.attachments && (
                            <span className="text-xs bg-background px-2 py-0.5 rounded">Files</span>
                          )}
                          {model.config.reasoning && (
                            <span className="text-xs bg-background px-2 py-0.5 rounded">Reasoning</span>
                          )}
                          {!model.config.attachments && !model.config.reasoning && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(model.fullString, model)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteModel(model.provider, model.modelId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Default Model Limits</CardTitle>
          <CardDescription>Double-click to append model to prefix (e.g., type "copilot/" then double-click)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(DEFAULT_MODEL_LIMITS).map(([model, limits]) => (
              <button
                key={model}
                onClick={() => {
                  if (!newModel) {
                    setNewModel(model);
                    if (!newContext) setNewContext(limits.context.toString());
                    if (!newOutput && limits.output) setNewOutput(limits.output.toString());
                  }
                }}
                onDoubleClick={() => {
                  const prefix = newModel.endsWith("/") ? newModel : (newModel ? newModel + "/" : "");
                  setNewModel(prefix + model);
                  setNewContext(limits.context.toString());
                  if (limits.output) setNewOutput(limits.output.toString());
                }}
                className="flex items-center justify-between p-2 bg-muted/50 hover:bg-muted rounded text-sm text-left transition-colors gap-2"
              >
                <span className="font-mono text-xs truncate flex-1">{model}</span>
                <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                  {formatTokens(limits.context)}
                  {limits.output && <span className="text-primary/60 ml-1">/{formatTokens(limits.output)}</span>}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Format: context window / output limit
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
