"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Editor } from "@monaco-editor/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProjectRules, saveProjectRules } from "@/lib/api";
import type { RulesResponse } from "@/types";
import { PageHelp } from "@/components/page-help";
import { Plus, Save } from "@nsmr/pixelart-react";

const templates = [
  {
    id: "nextjs",
    name: "React / Next.js",
    description: "App Router, TypeScript, Tailwind conventions",
    content: `# Project Rules (Next.js)\n\n## Stack\n- Next.js App Router\n- React with TypeScript\n- Tailwind v4\n\n## Conventions\n- Client components for interactivity\n- API calls via @/lib/api\n- Use shadcn/ui components from @/components/ui\n- Keep components small and focused\n\n## Code Style\n- Prefer const/let over var\n- Avoid any/ts-ignore\n- Use cn() for class merging\n`,
  },
  {
    id: "python",
    name: "Python Script",
    description: "Script structure and linting basics",
    content: `# Python Script Rules\n\n## Stack\n- Python 3.11+\n- Type hints required\n\n## Conventions\n- Keep functions small\n- Use pathlib for paths\n- Add docstrings\n\n## Tooling\n- ruff for linting\n- black or ruff format\n`,
  },
];

export default function RulesPage() {
  const { theme } = useTheme();
  const [content, setContent] = useState("");
  const [source, setSource] = useState<RulesResponse["source"]>("none");
  const [path, setPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    try {
      const data = await getProjectRules();
      setContent(data.content || "");
      setSource(data.source || "none");
      setPath(data.path || null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load rules");
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSave = async () => {
    const target = source === "none" ? "AGENTS.md" : source;
    try {
      setSaving(true);
      await saveProjectRules(content, target);
      toast.success("Rules saved");
      setSource(target);
      loadRules();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save rules");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <PageHelp title="Project Rules" docUrl="https://opencode.ai/docs/rules" docTitle="Project Rules (AGENTS.md) Editor" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{source === "none" ? "Not Found" : source}</Badge>
            {path && <span className="font-mono">{path}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={source === "none" ? "AGENTS.md" : source} onValueChange={(v) => setSource(v as RulesResponse["source"]) }>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AGENTS.md">AGENTS.md</SelectItem>
              <SelectItem value="CLAUDE.md">CLAUDE.md</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="rounded-md border border-border/70 p-3">
                <div className="text-sm font-medium">{tpl.name}</div>
                <div className="text-xs text-muted-foreground">{tpl.description}</div>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => setContent(tpl.content)}
                >
                  <Plus className="h-4 w-4" />
                  Insert
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="rounded-md border border-border/70 bg-background">
          <Editor
            height="70vh"
            language="markdown"
            theme={theme === "dark" ? "vs-dark" : "light"}
            value={content}
            onChange={(value) => setContent(value || "")}
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        </div>
      </div>
    </div>
  );
}
