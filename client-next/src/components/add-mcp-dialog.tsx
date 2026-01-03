"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertCircle, Wand2, X } from "lucide-react";
import type { MCPConfig } from "@/types";

interface AddMCPDialogProps {
  onAdd: (name: string, config: MCPConfig) => Promise<void>;
}

interface EnvVar {
  key: string;
  value: string;
}

function parseCommand(input: string): { name: string; command: string[]; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  const command: string[] = [];
  const args: string[] = [];
  let packageName = "";
  let foundPackage = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (!foundPackage) {
      if (part === "npx" || part === "npm" || part === "node" || part === "exec" || part === "--" || part === "-y" || part === "--yes") {
        command.push(part);
      } else if (part.startsWith("-")) {
        command.push(part);
      } else {
        command.push(part);
        packageName = part;
        foundPackage = true;
      }
    } else {
      args.push(part);
    }
  }

  const name = packageName
    .replace(/^@[^/]+\//, "")
    .replace(/^mcp-server-/, "")
    .replace(/^server-/, "")
    .replace(/-mcp$/, "")
    || "mcp-server";

  return { name, command, args };
}

export function AddMCPDialog({ onAdd }: AddMCPDialogProps) {
  const [open, setOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"local" | "sse">("local");
  const [enabled, setEnabled] = useState(true);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = () => {
    setPasteInput("");
    setName("");
    setCommand("");
    setArgs("");
    setUrl("");
    setType("local");
    setEnabled(true);
    setEnvVars([]);
    setError("");
    setShowAdvanced(false);
  };

  useEffect(() => {
    if (!pasteInput.trim()) return;
    
    const parsed = parseCommand(pasteInput);
    if (parsed) {
      setName(parsed.name);
      setCommand(parsed.command.join(" "));
      setArgs(parsed.args.join(" "));
      setType("local");
    }
  }, [pasteInput]);

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a server name");
      return;
    }

    if (name.includes(" ")) {
      setError("Server name should not contain spaces");
      return;
    }

    const env: Record<string, string> = {};
    for (const { key, value } of envVars) {
      if (key.trim()) {
        env[key.trim()] = value;
      }
    }

    if (type === "local") {
      if (!command.trim()) {
        setError("Please enter a command");
        return;
      }

      const commandArray = command.trim().split(/\s+/);
      const argsArray = args.trim() ? args.trim().split(/\s+/) : [];

      try {
        setLoading(true);
        const config: MCPConfig = {
          command: commandArray,
          enabled,
          type: "local",
        };
        if (argsArray.length > 0) {
          config.args = argsArray;
        }
        if (Object.keys(env).length > 0) {
          config.env = env;
        }
        await onAdd(name, config);
        resetForm();
        setOpen(false);
      } catch {
        setError("Failed to add server");
      } finally {
        setLoading(false);
      }
    } else {
      if (!url.trim()) {
        setError("Please enter a URL");
        return;
      }

      try {
        new URL(url);
      } catch {
        setError("Invalid URL format");
        return;
      }

      try {
        setLoading(true);
        const config: MCPConfig = {
          url,
          enabled,
          type: "sse",
        };
        if (Object.keys(env).length > 0) {
          config.env = env;
        }
        await onAdd(name, config);
        resetForm();
        setOpen(false);
      } catch {
        setError("Failed to add server");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-32 border-dashed">
          <Plus className="h-6 w-6 mr-2" />
          Add MCP Server
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 p-3 bg-background rounded-lg border border-dashed">
            <Label className="flex items-center gap-2 text-sm">
              <Wand2 className="h-4 w-4" />
              Quick Add - Paste npx command
            </Label>
            <Input
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="npx -y @modelcontextprotocol/server-memory"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Paste any npx/npm command and it will auto-fill the fields below
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., memory-server"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "local" | "sse")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local (stdio)</SelectItem>
                <SelectItem value="sse">Remote (SSE)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "local" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Input
                  id="command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx -y @modelcontextprotocol/server-memory"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="args">Arguments (optional)</Label>
                <Input
                  id="args"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="/path/to/dir --flag value"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Additional arguments passed to the command
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3000/sse"
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-muted-foreground"
            >
              {showAdvanced ? "Hide" : "Show"} Advanced Options
            </Button>

            {showAdvanced && (
              <div className="space-y-4 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Enabled on add</Label>
                  <Switch
                    id="enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Environment Variables</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addEnvVar}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {envVars.map((env, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="KEY"
                        value={env.key}
                        onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                        className="font-mono text-sm"
                      />
                      <Input
                        placeholder="value"
                        value={env.value}
                        onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                        className="font-mono text-sm"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeEnvVar(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {envVars.length === 0 && (
                    <p className="text-xs text-muted-foreground">No environment variables</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Server"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
