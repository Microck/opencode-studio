"use client";

import { useMemo, useState } from "react";
import type { PermissionConfig, PermissionValue } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trash } from "@nsmr/pixelart-react";

const TOOL_LIST = [
  "read",
  "edit",
  "glob",
  "grep",
  "list",
  "bash",
  "task",
  "skill",
  "lsp",
  "todoread",
  "todowrite",
  "webfetch",
  "external_directory",
  "doom_loop",
] as const;

type PermissionMode = "simple" | "map" | "list";

function getMode(value: PermissionConfig[keyof PermissionConfig] | undefined): PermissionMode {
  if (!value || typeof value === "string") return "simple";
  const keys = Object.keys(value);
  const isList = keys.every((k) => k === "allow" || k === "deny");
  return isList ? "list" : "map";
}

function toArrayInput(values?: string[]) {
  return (values || []).join(", ");
}

function fromArrayInput(input: string) {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

interface PermissionEditorProps {
  value: PermissionConfig;
  onChange: (next: PermissionConfig) => void;
  className?: string;
}

export function PermissionEditor({ value, onChange, className }: PermissionEditorProps) {
  const [patternDrafts, setPatternDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);

  const tools = useMemo(() => {
    return TOOL_LIST.filter((t) => {
      const matchesSearch = t.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (onlyEnabled) {
        const current = value[t as keyof PermissionConfig];
        return !!current && current !== "ask";
      }
      return true;
    });
  }, [search, onlyEnabled, value]);

  const updateTool = (tool: keyof PermissionConfig, next: any) => {
    onChange({
      ...value,
      [tool]: next,
    } as PermissionConfig);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search tools..."
            className="h-8 w-[150px] lg:w-[240px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 gap-2", onlyEnabled && "bg-accent text-accent-foreground")}
            onClick={() => setOnlyEnabled(!onlyEnabled)}
          >
            Enabled Only
          </Button>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {tools.length} tools found
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-3">
        {tools.map((tool) => {
          const current = value[tool as keyof PermissionConfig];
          const mode = getMode(current);
          const draft = patternDrafts[tool] || "";

          return (
            <div key={tool} className="rounded-md border bg-muted/20 border-border/60 p-4 transition-colors hover:border-border">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary/40" />
                  <div className="font-mono text-sm font-medium">{tool}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={mode}
                    onValueChange={(next) => {
                      if (next === "simple") updateTool(tool as keyof PermissionConfig, "ask");
                      if (next === "map") updateTool(tool as keyof PermissionConfig, { "*": "ask" } as PermissionConfig);
                      if (next === "list")
                        updateTool(
                          tool as keyof PermissionConfig,
                          { allow: [], deny: [] } as unknown as PermissionConfig[keyof PermissionConfig]
                        );
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="map">Pattern Map</SelectItem>
                      <SelectItem value="list">Allow/Deny List</SelectItem>
                    </SelectContent>
                  </Select>

                  {mode === "simple" && (
                    <Select
                      value={typeof current === "string" ? current : "ask"}
                      onValueChange={(next) => updateTool(tool as keyof PermissionConfig, next as PermissionValue)}
                    >
                      <SelectTrigger className="w-[100px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="ask">Ask</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {mode === "map" &&
                typeof current === "object" &&
                current &&
                !Array.isArray(current) &&
                !("allow" in current || "deny" in current) && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    {Object.entries(current as Record<string, PermissionValue>).map(([pattern, rule]) => (
                      <div key={pattern} className="flex flex-col gap-2 md:flex-row md:items-center">
                        <Input className="font-mono h-8 text-xs flex-1" value={pattern} readOnly />
                        <Select
                          value={rule as string}
                          onValueChange={(next) => {
                            updateTool(tool as keyof PermissionConfig, { ...current, [pattern]: next });
                          }}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="allow">Allow</SelectItem>
                            <SelectItem value="ask">Ask</SelectItem>
                            <SelectItem value="deny">Deny</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const { [pattern]: _removed, ...rest } = current as any;
                            updateTool(tool as keyof PermissionConfig, Object.keys(rest).length ? rest : "ask");
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex flex-col gap-2 md:flex-row md:items-center pt-2">
                      <Input
                        className="font-mono h-8 text-xs flex-1"
                        placeholder='Add pattern, e.g. "git *"'
                        value={draft}
                        onChange={(e) => setPatternDrafts((prev) => ({ ...prev, [tool]: e.target.value }))}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 text-xs"
                        onClick={() => {
                          if (!draft.trim()) return;
                          updateTool(tool as keyof PermissionConfig, { ...current, [draft.trim()]: "ask" });
                          setPatternDrafts((prev) => ({ ...prev, [tool]: "" }));
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}

              {mode === "list" && typeof current === "object" && current && ("allow" in current || "deny" in current) && (
                <div className="mt-4 grid gap-4 md:grid-cols-2 border-t pt-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Allow Patterns
                    </div>
                    <Textarea
                      className="min-h-[80px] text-xs font-mono resize-none"
                      value={toArrayInput((current as { allow?: string[] }).allow)}
                      onChange={(e) => {
                        updateTool(tool as keyof PermissionConfig, {
                          ...(current as object),
                          allow: fromArrayInput(e.target.value),
                        });
                      }}
                      placeholder="e.g. src/**/*.ts, lib/*.js"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Deny Patterns
                    </div>
                    <Textarea
                      className="min-h-[80px] text-xs font-mono resize-none border-destructive/20 focus-visible:border-destructive/40"
                      value={toArrayInput((current as { deny?: string[] }).deny)}
                      onChange={(e) => {
                        updateTool(tool as keyof PermissionConfig, {
                          ...(current as object),
                          deny: fromArrayInput(e.target.value),
                        });
                      }}
                      placeholder="e.g. secrets/**, *.key"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
