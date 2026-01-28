"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, ArrowLeft } from "@nsmr/pixelart-react"
import { getSkill, saveSkill, getPlugin, savePlugin, deleteSkill, getCommand, saveCommand, deleteCommand } from "@/lib/api";
import { toast } from "sonner";
import type { SkillInfo, PluginInfo } from "@/types";
import { PageHelp } from "@/components/page-help";

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type") as "skills" | "plugins" | "commands" | null;
  const name = searchParams.get("name");
  const isNew = searchParams.get("new") === "true";

  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!type || !name) {
      router.push("/skills");
      return;
    }

    if (isNew) {
      const defaultContent = type === "skills" ? "## When to Use\n\n## Instructions\n\n" : 
                             type === "commands" ? "Instructions:\n" : 
                             "// New Plugin\n\n";
      setContent(defaultContent);
      setCurrentName(name);
      setLoading(false);
      return;
    }

    const loadFile = async () => {
      try {
        setLoading(true);
        if (type === "skills") {
          const data = await getSkill(name);
          setContent(data.content);
          const match = data.content.match(/<description>([\s\S]*?)<\/description>/);
          setDescription(data.description || (match ? match[1].trim() : ""));
          setCurrentName(name);
        } else if (type === "commands") {
          const data = await getCommand(name);
          setContent(data.template);
          setCurrentName(name);
        } else {
          const data = await getPlugin(name);
          setContent(data.content);
          setCurrentName(name);
        }
      } catch {
        toast.error("Failed to load file");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [type, name, isNew, router]);

  const handleSave = async () => {
    if (!type || !name) return;

    try {
      setSaving(true);
      if (type === "skills") {
        if (!description.trim()) {
          toast.error("Description is required for skills");
          return;
        }
        const targetName = currentName.trim() || name;
        let finalContent = content;
        if (finalContent.includes("<description>")) {
            finalContent = finalContent.replace(/<description>[\s\S]*?<\/description>/, `<description>${description}</description>`);
        } else {
            finalContent = `<description>\n${description}\n</description>\n\n${finalContent}`;
        }

        await saveSkill(targetName, description, finalContent);

        if (targetName !== name && !isNew) {
            await deleteSkill(name);
            router.replace(`/editor?type=skills&name=${encodeURIComponent(targetName)}`);
        }
      } else if (type === "commands") {
        const targetName = currentName.trim() || name;
        await saveCommand(targetName, content);
        if (targetName !== name && !isNew) {
            await deleteCommand(name);
            router.replace(`/editor?type=commands&name=${encodeURIComponent(targetName)}`);
        }
      } else {
        await savePlugin(name, content);
      }
      toast.success(`Saved ${currentName || name}`);
    } catch {
      toast.error("Failed to save file");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push(`/${type}`);
  };

  if (!type || !name) {
    return null;
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="flex-1" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex justify-center">
          {type === "skills" || type === "commands" ? (
            <div className="flex items-center gap-2 w-full max-w-md">
              <Input
                value={currentName}
                onChange={(e) => setCurrentName(e.target.value)}
                className="font-mono font-bold h-9"
              />
              <PageHelp
                title={type === "skills" ? "Edit Skill" : "Edit Command"}
                docUrl={type === "skills" ? "https://opencode.ai/docs/skills" : "https://opencode.ai/docs/commands"}
                docTitle={`${type === "skills" ? "Skill" : "Command"} Documentation`}
              />
            </div>
          ) : (
            <PageHelp
              title={name}
              docUrl="https://opencode.ai/docs/plugins"
              docTitle="Plugin Documentation"
            />
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {type === "skills" && (
        <div className="space-y-2">
          <Label htmlFor="skill-description">Description</Label>
          <Input
            id="skill-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this skill does"
          />
          <p className="text-xs text-muted-foreground">
            Required. Helps the agent decide when to use this skill.
          </p>
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 font-mono text-sm resize-none min-h-[calc(100vh-280px)]"
        spellCheck={false}
      />
    </div>
  );
}

export default function EditorPage() {
  return <EditorContent />;
}
