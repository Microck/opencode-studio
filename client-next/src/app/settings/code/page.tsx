"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/context";
import { getSystemTools } from "@/lib/api";
import type { SystemToolInfo } from "@/types";
import { PageHelp } from "@/components/page-help";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const LSP_LIST = [
  { id: "typescript", label: "TypeScript", tool: "typescript-language-server" },
  { id: "eslint", label: "ESLint", tool: "eslint" },
  { id: "pyright", label: "Pyright", tool: "pyright" },
  { id: "gopls", label: "Go (gopls)", tool: "gopls" },
  { id: "rust", label: "Rust", tool: "rust-analyzer" },
  { id: "clangd", label: "Clangd", tool: "clangd" },
  { id: "dart", label: "Dart", tool: "dart" },
  { id: "jdtls", label: "Java", tool: "jdtls" },
  { id: "kotlin-ls", label: "Kotlin", tool: "kotlin-language-server" },
  { id: "lua-ls", label: "Lua", tool: "lua-language-server" },
  { id: "ocaml-lsp", label: "OCaml", tool: "ocamllsp" },
  { id: "nixd", label: "Nix", tool: "nixd" },
  { id: "sourcekit-lsp", label: "Swift", tool: "sourcekit-lsp" },
];

const FORMATTER_LIST = [
  { id: "prettier", label: "Prettier", tool: "prettier" },
  { id: "biome", label: "Biome", tool: "biome" },
  { id: "gofmt", label: "gofmt", tool: "gofmt" },
  { id: "rustfmt", label: "rustfmt", tool: "rustfmt" },
  { id: "ruff", label: "ruff", tool: "ruff" },
  { id: "clang-format", label: "clang-format", tool: "clang-format" },
  { id: "ktlint", label: "ktlint", tool: "ktlint" },
  { id: "deno", label: "deno fmt", tool: "deno" },
  { id: "mix", label: "mix format", tool: "mix" },
  { id: "zig", label: "zig fmt", tool: "zig" },
];

export default function CodeSettingsPage() {
  const { config, saveConfig } = useApp();
  const [tools, setTools] = useState<SystemToolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTools = async () => {
      try {
        const data = await getSystemTools();
        setTools(data);
      } catch (err: any) {
        toast.error(err?.message || "Failed to load system tools");
      } finally {
        setLoading(false);
      }
    };
    loadTools();
  }, []);

  const toolMap = useMemo(() => {
    const map = new Map<string, SystemToolInfo>();
    tools.forEach((tool) => map.set(tool.name, tool));
    return map;
  }, [tools]);

  const updateLsp = (id: string, next: any) => {
    if (!config) return;
    saveConfig({
      ...config,
      lsp: {
        ...(config.lsp || {}),
        [id]: { ...(config.lsp?.[id] || {}), ...next },
      },
    });
  };

  const updateFormatter = (id: string, next: any) => {
    if (!config) return;
    saveConfig({
      ...config,
      formatter: {
        ...(config.formatter || {}),
        [id]: { ...(config.formatter?.[id] || {}), ...next },
      },
    });
  };

  return (
    <div className="space-y-4">
      <PageHelp title="Code Settings" docUrl="https://opencode.ai/docs" docTitle="LSP & Formatter Manager" />

      <Card>
        <CardHeader>
          <CardTitle>LSP Servers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {LSP_LIST.map((item) => {
            const cfg = config?.lsp?.[item.id] as any;
            const tool = toolMap.get(item.tool);
            return (
              <div key={item.id} className="grid gap-3 md:grid-cols-[1.4fr_0.6fr_0.4fr_1.6fr] md:items-center">
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.id}</div>
                </div>
                <Badge variant={tool?.available ? "secondary" : "outline"}>
                  {loading ? "Checking" : tool?.available ? "Detected" : "Not Found"}
                </Badge>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!cfg?.disabled}
                    onCheckedChange={(checked) => updateLsp(item.id, { disabled: !checked })}
                  />
                  <span className="text-xs text-muted-foreground">Enabled</span>
                </div>
                <Input
                  placeholder="Command override"
                  value={Array.isArray(cfg?.command) ? cfg.command.join(" ") : ""}
                  onChange={(e) => updateLsp(item.id, { command: e.target.value.split(" ").filter(Boolean) })}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <PageHelp title="Code Settings" docUrl="https://opencode.ai/docs/settings/code" docTitle="LSP & Formatter Manager" />
          <CardTitle>LSP Servers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FORMATTER_LIST.map((item) => {
            const cfg = config?.formatter?.[item.id] as any;
            const tool = toolMap.get(item.tool);
            return (
              <div key={item.id} className="grid gap-3 md:grid-cols-[1.4fr_0.6fr_0.4fr_1.6fr] md:items-center">
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.id}</div>
                </div>
                <Badge variant={tool?.available ? "secondary" : "outline"}>
                  {loading ? "Checking" : tool?.available ? "Detected" : "Not Found"}
                </Badge>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!cfg?.disabled}
                    onCheckedChange={(checked) => updateFormatter(item.id, { disabled: !checked })}
                  />
                  <span className="text-xs text-muted-foreground">Enabled</span>
                </div>
                <Input
                  placeholder="Command override"
                  value={Array.isArray(cfg?.command) ? cfg.command.join(" ") : ""}
                  onChange={(e) => updateFormatter(item.id, { command: e.target.value.split(" ").filter(Boolean) })}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
