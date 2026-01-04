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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertCircle, Wand2 } from "lucide-react";
import type { MCPConfig } from "@/types";

interface AddMCPDialogProps {
  onAdd: (name: string, config: MCPConfig) => Promise<void>;
}

function parseCommand(input: string): { name: string; config: MCPConfig } | null {
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

  const config: MCPConfig = {
    command,
    enabled: true,
    type: "local",
  };
  if (args.length > 0) {
    config.args = args;
  }

  return { name, config };
}

function buildDefaultConfig(): MCPConfig {
  return {
    command: [],
    enabled: true,
    type: "local",
  };
}

export function AddMCPDialog({ onAdd }: AddMCPDialogProps) {
  const [open, setOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [name, setName] = useState("");
  const [configJson, setConfigJson] = useState(() => JSON.stringify(buildDefaultConfig(), null, 2));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setPasteInput("");
    setName("");
    setConfigJson(JSON.stringify(buildDefaultConfig(), null, 2));
    setError("");
  };

  useEffect(() => {
    if (!pasteInput.trim()) return;
    
    const parsed = parseCommand(pasteInput);
    if (parsed) {
      setName(parsed.name);
      setConfigJson(JSON.stringify(parsed.config, null, 2));
    }
  }, [pasteInput]);

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

    let config: MCPConfig;
    try {
      config = JSON.parse(configJson);
      if (typeof config !== "object" || Array.isArray(config)) {
        setError("Config must be a JSON object");
        return;
      }
    } catch {
      setError("Invalid JSON");
      return;
    }

    try {
      setLoading(true);
      await onAdd(name, config);
      resetForm();
      setOpen(false);
    } catch {
      setError("Failed to add server");
    } finally {
      setLoading(false);
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
              Paste any npx/npm command to auto-generate the config below
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
            <Label htmlFor="configJson">Config (JSON)</Label>
            <Textarea
              id="configJson"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              className="font-mono text-sm min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Full MCP config object. Edit directly to add env, timeout, oauth, etc.
            </p>
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
