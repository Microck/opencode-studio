"use client";

import { useMemo, useState } from "react";
import type { PermissionConfig, PermissionValue } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const tools = useMemo(() => TOOL_LIST, []);

  const updateTool = (tool: keyof PermissionConfig, next: any) => {
    onChange({
      ...value,
      [tool]: next,
    } as PermissionConfig);
  };

  return (
    <Card className={cn("border-muted-foreground/30", className)}>
      <CardHeader>
        <CardTitle className="text-base">Permissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tools.map((tool) => {
          const current = value[tool as keyof PermissionConfig];
          const mode = getMode(current);
          const draft = patternDrafts[tool] || "";

          return (
            <div key={tool} className="rounded-md border border-border/60 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="font-mono text-xs text-muted-foreground">{tool}</div>
                <div className="flex gap-2">
                  <Select
                    value={mode}
                    onValueChange={(next) => {
                      if (next === "simple") updateTool(tool as keyof PermissionConfig, "ask");
                      if (next === "map") updateTool(tool as keyof PermissionConfig, { "*": "ask" } as PermissionConfig);
                      if (next === "list") updateTool(tool as keyof PermissionConfig, { allow: [], deny: [] } as unknown as PermissionConfig[keyof PermissionConfig]);
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
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
                      <SelectTrigger className="w-[140px]">
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

              {mode === "map" && typeof current === "object" && current && !Array.isArray(current) && !("allow" in current || "deny" in current) && (
                <div className="mt-3 space-y-2">
                  {Object.entries(current as Record<string, PermissionValue>).map(([pattern, rule]) => (
                    <div key={pattern} className="flex flex-col gap-2 md:flex-row md:items-center">
                      <Input className="font-mono" value={pattern} readOnly />
                      <Select
                        value={rule as string}
                        onValueChange={(next) => {
                          updateTool(tool as keyof PermissionConfig, { ...current, [pattern]: next });
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
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
                        onClick={() => {
                          const { [pattern]: _removed, ...rest } = current as any;
                          updateTool(tool as keyof PermissionConfig, Object.keys(rest).length ? rest : "ask");
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <Input
                      className="font-mono"
                      placeholder='Add pattern, e.g. "git *"'
                      value={draft}
                      onChange={(e) => setPatternDrafts((prev) => ({ ...prev, [tool]: e.target.value }))}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!draft.trim()) return;
                        updateTool(tool as keyof PermissionConfig, { ...current, [draft.trim()]: "ask" });
                        setPatternDrafts((prev) => ({ ...prev, [tool]: "" }));
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {mode === "list" && typeof current === "object" && current && ("allow" in current || "deny" in current) && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Allow</div>
                    <Textarea
                      value={toArrayInput((current as { allow?: string[] }).allow)}
                      onChange={(e) => {
                        updateTool(tool as keyof PermissionConfig, {
                          ...(current as object),
                          allow: fromArrayInput(e.target.value),
                        });
                      }}
                      placeholder="comma separated patterns"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Deny</div>
                    <Textarea
                      value={toArrayInput((current as { deny?: string[] }).deny)}
                      onChange={(e) => {
                        updateTool(tool as keyof PermissionConfig, {
                          ...(current as object),
                          deny: fromArrayInput(e.target.value),
                        });
                      }}
                      placeholder="comma separated patterns"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
