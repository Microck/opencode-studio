"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, ArrowLeft } from "lucide-react";
import { getSkill, saveSkill, getPlugin, savePlugin } from "@/lib/api";
import { toast } from "sonner";

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type") as "skills" | "plugins" | null;
  const name = searchParams.get("name");
  const isNew = searchParams.get("new") === "true";

  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!type || !name) {
      router.push("/skills");
      return;
    }

    if (isNew) {
      setContent(type === "skills" ? "## When to Use\n\n## Instructions\n\n" : "// New Plugin\n\n");
      setLoading(false);
      return;
    }

    const loadFile = async () => {
      try {
        setLoading(true);
        if (type === "skills") {
          const data = await getSkill(name);
          setContent(data.content);
          setDescription(data.description || "");
        } else {
          const data = await getPlugin(name);
          setContent(data.content);
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
        await saveSkill(name, description, content);
      } else {
        await savePlugin(name, content);
      }
      toast.success(`Saved ${name}`);
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
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold font-mono">{name}</h1>
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
  return (
    <Suspense fallback={
      <div className="h-full flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="flex-1" />
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
